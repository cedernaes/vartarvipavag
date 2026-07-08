import speakeasy from 'speakeasy';
import qrcode from 'qrcode';

async function setup() {
  const secret = speakeasy.generateSecret({
    name: 'Vart är vi på väg? (Admin)',
    length: 20,
  });

  console.log('\n=== 2FA Setup ===\n');
  console.log('Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.):\n');

  const qr = await qrcode.toString(secret.otpauth_url!, { type: 'terminal', small: true });
  console.log(qr);

  console.log('Or enter this key manually into your authenticator app:');
  console.log(`  ${secret.base32}\n`);

  console.log('Then add the following line to your server/.env file:');
  console.log(`  ADMIN_TOTP_SECRET=${secret.base32}\n`);
}

setup().catch(console.error);
