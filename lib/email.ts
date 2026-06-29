import { sendMail } from './mailer';

interface SendWaitlistEmailOptions {
  email: string;
  reason?: string;
}

export async function sendWaitlistConfirmation({ email, reason }: SendWaitlistEmailOptions): Promise<boolean> {
  // Create email content with terminal styling theme
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Keystrok Waitlist</title>
  <style>
    body {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      background-color: #0a0a0a;
      color: #4ade80;
      margin: 0;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #1a1a1a;
      border: 1px solid #333;
      padding: 30px;
      border-radius: 8px;
    }
    .header {
      color: #4ade80;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .prompt {
      color: #8b5cf6;
      margin-bottom: 10px;
    }
    .output {
      color: #d4d4d4;
      margin-bottom: 15px;
    }
    .success {
      color: #4ade80;
      font-weight: bold;
      margin: 20px 0;
    }
    .comment {
      color: #a0a0a0;
      font-size: 12px;
      font-style: italic;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #333;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">#!/bin/bash</div>
    <div class="comment"># Keystrok Waitlist Confirmation</div>
    <br>

    <div class="prompt">$ echo "Processing waitlist signup..."</div>
    <div class="output">Processing waitlist signup...</div>

    <div class="prompt">$ validate_email "${email}"</div>
    <div class="success">✓ Email validated: ${email}</div>

    ${reason ? `<div class="prompt">$ echo "User interest: ${reason}"</div>` : ''}
    ${reason ? `<div class="output">User interest: ${reason}</div>` : ''}

    <div class="success">✓ Successfully added to Keystrok waitlist!</div>

    <div class="output">
      Welcome to Keystrok early access! We're building something special for API key security,
      and you'll be among the first to know when we launch.
    </div>

    <div class="comment"># What happens next:</div>
    <div class="output">
      • You'll receive updates on our development progress<br>
      • Early access invitation when we're ready<br>
      • Exclusive features and insights on API security
    </div>

    <div class="comment"># Stay secure while you wait</div>

    <div class="footer">
      <div class="comment">
        This email was sent to ${email} because you signed up for the Keystrok waitlist.<br>
        If you didn't sign up, you can safely ignore this email.
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `#!/bin/bash
# Keystrok Waitlist Confirmation

$ echo "Processing waitlist signup..."
Processing waitlist signup...

$ validate_email "${email}"
✓ Email validated: ${email}

${reason ? `$ echo "User interest: ${reason}"\nUser interest: ${reason}\n` : ''}
✓ Successfully added to Keystrok waitlist!

Welcome to Keystrok early access! We're building something special for API key security,
and you'll be among the first to know when we launch.

# What happens next:
• You'll receive updates on our development progress
• Early access invitation when we're ready
• Exclusive features and insights on API security

# Stay secure while you wait

This email was sent to ${email} because you signed up for the Keystrok waitlist.
If you didn't sign up, you can safely ignore this email.
`;

  return sendMail({
    to: email,
    subject: '✓ Welcome to Keystrok Waitlist',
    text: textContent,
    html: htmlContent,
  });
}

// Test email configuration
export async function testEmailConfiguration(): Promise<{ success: boolean; message: string }> {
  try {
    // Test by sending a test email to a test address
    const testResult = await sendWaitlistConfirmation({
      email: 'test@example.com',
      reason: 'Testing email configuration'
    });

    return {
      success: testResult,
      message: testResult ? 'Email configuration is working' : 'Email configuration failed'
    };
  } catch (error) {
    return {
      success: false,
      message: `Email configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
