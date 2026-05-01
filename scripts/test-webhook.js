/**
 * Payment Webhook Simulator
 * Mengirim HTTP POST request ke endpoint webhook lokal
 * untuk mensimulasikan notifikasi dari payment gateway (Midtrans/Xendit)
 *
 * Penggunaan:
 *   node scripts/test-webhook.js [settlement|expire|pending|failed]
 *
 * Endpoint target: http://localhost:3000/api/webhooks/payment
 * (Pastikan server Next.js sedang berjalan: npm run dev)
 */

const http = require('http');

const SCENARIOS = {
  settlement: {
    label: 'Pembayaran Berhasil (Settlement)',
    payload: {
      transaction_time: '2024-03-15 14:23:11',
      transaction_status: 'settlement',
      transaction_id: 'TEST-TRX-' + Date.now(),
      status_message: 'midtrans payment notification',
      status_code: '200',
      signature_key: 'dummy-signature-key-' + Date.now(),
      payment_type: 'bank_transfer',
      order_id: 'ORG-001-' + Date.now(),
      merchant_id: 'TEST-MERCHANT',
      gross_amount: '1500000.00',
      fraud_status: 'accept',
      currency: 'IDR',
    },
  },

  expire: {
    label: 'Transaksi Kadaluarsa (Expire)',
    payload: {
      transaction_time: '2024-03-15 14:23:11',
      transaction_status: 'expire',
      transaction_id: 'TEST-TRX-' + Date.now(),
      status_message: 'midtrans payment notification',
      status_code: '202',
      signature_key: 'dummy-signature-key-' + Date.now(),
      payment_type: 'bank_transfer',
      order_id: 'ORG-001-' + Date.now(),
      merchant_id: 'TEST-MERCHANT',
      gross_amount: '2500000.00',
      fraud_status: 'accept',
      currency: 'IDR',
    },
  },

  pending: {
    label: 'Menunggu Pembayaran (Pending)',
    payload: {
      transaction_time: '2024-03-15 14:23:11',
      transaction_status: 'pending',
      transaction_id: 'TEST-TRX-' + Date.now(),
      status_message: 'midtrans payment notification',
      status_code: '201',
      signature_key: 'dummy-signature-key-' + Date.now(),
      payment_type: 'bank_transfer',
      order_id: 'ORG-001-' + Date.now(),
      merchant_id: 'TEST-MERCHANT',
      gross_amount: '500000.00',
      fraud_status: 'accept',
      currency: 'IDR',
    },
  },

  failed: {
    label: 'Pembayaran Gagal (Failed)',
    payload: {
      transaction_time: '2024-03-15 14:23:11',
      transaction_status: 'deny',
      transaction_id: 'TEST-TRX-' + Date.now(),
      status_message: 'midtrans payment notification',
      status_code: '202',
      signature_key: 'dummy-signature-key-' + Date.now(),
      payment_type: 'credit_card',
      order_id: 'ORG-001-' + Date.now(),
      merchant_id: 'TEST-MERCHANT',
      gross_amount: '1000000.00',
      fraud_status: 'deny',
      currency: 'IDR',
    },
  },
};

const HOST = process.env.WEBHOOK_HOST || 'localhost';
const PORT = process.env.WEBHOOK_PORT || '3000';
const PATH = process.env.WEBHOOK_PATH || '/api/webhooks/payment';

function sendWebhook(scenarioKey) {
  const scenario = SCENARIOS[scenarioKey];
  if (!scenario) {
    console.error(`❌ Skenario tidak valid: "${scenarioKey}"`);
    console.log('   Skenario yang tersedia:', Object.keys(SCENARIOS).join(', '));
    process.exit(1);
  }

  const postData = JSON.stringify(scenario.payload);

  const options = {
    hostname: HOST,
    port: PORT,
    path: PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Accept': 'application/json',
      'X-Webhook-Source': 'test-webhook-script',
    },
  };

  console.log(`\n📤 Mengirim webhook: ${scenario.label}`);
  console.log(`   Endpoint: http://${HOST}:${PORT}${PATH}`);
  console.log(`   Status: ${scenario.payload.transaction_status.toUpperCase()}`);
  console.log(`   Order ID: ${scenario.payload.order_id}`);
  console.log(`   Amount: Rp ${parseInt(scenario.payload.gross_amount).toLocaleString('id-ID')}`);

  const req = http.request(options, (res) => {
    let responseData = '';

    console.log(`\n📥 Response Status: ${res.statusCode} ${res.statusMessage}`);

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      try {
        const parsed = JSON.parse(responseData);
        console.log('📦 Response Body:');
        console.log(JSON.stringify(parsed, null, 2));
      } catch {
        console.log('📦 Response Body (raw):');
        console.log(responseData || '(empty)');
      }
      console.log('\n✅ Webhook test selesai.\n');
    });
  });

  req.on('error', (err) => {
    console.error(`\n❌ Error mengirim webhook: ${err.message}`);
    if (err.code === 'ECONNREFUSED') {
      console.log('   💡 Pastikan server Next.js berjalan di http://localhost:3000');
      console.log('   Jalankan: npm run dev');
    }
    process.exit(1);
  });

  req.write(postData);
  req.end();
}

// Main
const scenarioArg = process.argv[2] || 'settlement';

console.log('='.repeat(60));
console.log('  Payment Webhook Simulator');
console.log('  Simulasi notifikasi payment gateway (Midtrans/Xendit)');
console.log('='.repeat(60));

sendWebhook(scenarioArg);
