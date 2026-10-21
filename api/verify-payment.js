import crypto from 'node:crypto';

function sendJson(res, status, body) {
  res.status(status).json(body);
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
    return;
  }

  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = req.body || {};
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!orderId || !paymentId || !signature) {
    sendJson(res, 400, { error: 'Missing Razorpay payment fields.' });
    return;
  }
  if (!keySecret) {
    sendJson(res, 500, { error: 'Razorpay is not configured on the server.' });
    return;
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const isValid = signature.length === expectedSignature.length
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  sendJson(res, 200, { ok: isValid });
}
