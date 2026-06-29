import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { sendWaitlistConfirmation } from '../../../lib/email';
import { checkRateLimit, clientIpFromHeaders } from '../../../lib/rate-limit';

// Waitlist signups: at most 5 per IP per hour. Blunts a single source from
// spamming the list (and our confirmation-email quota) with junk addresses.
const WAITLIST_LIMIT = 5;
const WAITLIST_WINDOW_MS = 60 * 60 * 1000;

// Enhanced email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}

export async function POST(request: NextRequest) {
  try {
    // Throttle by client IP before doing any work.
    const ip = clientIpFromHeaders(request.headers);
    const rl = await checkRateLimit(`waitlist:ip:${ip}`, {
      limit: WAITLIST_LIMIT,
      windowMs: WAITLIST_WINDOW_MS,
    });
    if (!rl.allowed) {
      const retryAfter = Math.ceil(rl.retryAfterMs / 1000);
      return NextResponse.json(
        { error: 'Too many requests', message: 'You have signed up too many times. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const body = await request.json();
    const { email, reason } = body;

    // Input validation
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required', message: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format', message: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    if (reason && (typeof reason !== 'string' || reason.length > 500)) {
      return NextResponse.json(
        { error: 'Reason too long', message: 'Reason must be less than 500 characters' },
        { status: 400 }
      );
    }

    // Check for duplicate email using Prisma
    const existingEntry = await prisma.waitlist.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, createdAt: true }
    });

    if (existingEntry) {
      return NextResponse.json(
        { error: 'You\'re already on the waitlist!', message: 'This email is already registered for early access' },
        { status: 409 }
      );
    }

    // Create new waitlist entry using Prisma
    const waitlistEntry = await prisma.waitlist.create({
      data: {
        email: normalizedEmail,
        reason: reason?.trim() || null,
        signupLocation: 'landing_page_terminal',
        userAgent: request.headers.get('user-agent') || null,
        // Store a short hash of the IP for analytics (privacy-conscious).
        ipAddressHash: ip && ip !== 'unknown'
          ? Buffer.from(ip).toString('base64').substring(0, 16)
          : null
      },
      select: {
        id: true,
        email: true,
        createdAt: true
      }
    });

    // Create activity log entry for the signup
    try {
      await prisma.waitlistActivity.create({
        data: {
          waitlistId: waitlistEntry.id,
          activityType: 'signup',
          description: 'User signed up for waitlist via terminal interface',
          details: JSON.stringify({
            userAgent: request.headers.get('user-agent'),
            signupLocation: 'landing_page_terminal',
            hasReason: !!reason
          }),
          wasSuccessful: true
        }
      });
    } catch (activityError) {
      // Log but don't fail the request if activity logging fails
      console.warn('Failed to log waitlist activity:', activityError);
    }

    // Send confirmation email (non-blocking)
    sendWaitlistConfirmation({
      email: normalizedEmail,
      reason: reason?.trim()
    }).then(emailResult => {
      if (!emailResult) {
        console.warn('[waitlist] confirmation email not delivered; signup still recorded');
      }
    }).catch(emailError => {
      // Email failure must not affect signup success.
      console.error('[waitlist] confirmation email threw:', emailError instanceof Error ? emailError.message : emailError);
    });

    return NextResponse.json(
      { 
        success: true,
        message: 'Successfully added to waitlist!',
        data: {
          email: waitlistEntry.email,
          createdAt: waitlistEntry.createdAt
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Waitlist signup error:', error);
    
    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      // Handle Prisma specific errors
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'You\'re already on the waitlist!', message: 'This email is already registered' },
          { status: 409 }
        );
      }
      
      if (error.message.includes('Database')) {
        return NextResponse.json(
          { error: 'Database error', message: 'Unable to process signup right now. Please try again.' },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Something went wrong. Please try again later.'
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    // Simple health check - could include stats if needed
    const count = await prisma.waitlist.count();
    
    return NextResponse.json({
      status: 'healthy',
      waitlistCount: count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Database connection failed' },
      { status: 500 }
    );
  }
}