import { NextRequest, NextResponse } from 'next/server';
import { sendWaitlistConfirmation, testEmailConfiguration } from '../../../lib/email';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  console.log('🧪 [TEST-EMAIL] Test email endpoint called');

  // Authenticated-only: this endpoint sends real email, so it must never be
  // open to the public (spam / email-enumeration / cost abuse).
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { email, testType = 'configuration' } = body;
    
    console.log('🧪 [TEST-EMAIL] Request data:', { email, testType });
    
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required for testing' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log('🧪 [TEST-EMAIL] Testing email:', normalizedEmail);

    if (testType === 'configuration') {
      console.log('🧪 [TEST-EMAIL] Running email configuration test...');
      const result = await testEmailConfiguration();
      return NextResponse.json(result);
    }

    if (testType === 'send') {
      console.log('🧪 [TEST-EMAIL] Testing actual email send...');
      
      const emailResult = await sendWaitlistConfirmation({
        email: normalizedEmail,
        reason: 'Email delivery test from /api/test-email'
      });

      console.log('🧪 [TEST-EMAIL] Email send result:', emailResult);

      return NextResponse.json({
        success: emailResult,
        message: emailResult 
          ? `Test email sent successfully to ${normalizedEmail}` 
          : `Failed to send test email to ${normalizedEmail}`,
        email: normalizedEmail,
        testType: 'send'
      });
    }

    return NextResponse.json(
      { error: 'Invalid test type. Use "configuration" or "send"' },
      { status: 400 }
    );

  } catch (error) {
    console.error('🧪 [TEST-EMAIL] Test email endpoint error:', error);
    
    return NextResponse.json(
      { 
        error: 'Test email failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    );
  }
}

// GET endpoint to show test instructions
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    message: 'Email Test Endpoint',
    usage: {
      url: '/api/test-email',
      method: 'POST',
      body: {
        email: 'your-email@example.com',
        testType: 'send' // or 'configuration'
      }
    },
    testTypes: {
      configuration: 'Tests email service configuration without sending',
      send: 'Actually sends a test email to the specified address'
    },
    examples: [
      {
        description: 'Test configuration',
        curl: 'curl -X POST http://localhost:3001/api/test-email -H "Content-Type: application/json" -d \'{"email":"test@example.com","testType":"configuration"}\''
      },
      {
        description: 'Send test email',
        curl: 'curl -X POST http://localhost:3001/api/test-email -H "Content-Type: application/json" -d \'{"email":"your@email.com","testType":"send"}\''
      }
    ]
  });
}