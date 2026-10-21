const PLANS = {
  monthly: { amount: 1000, currency: 'USD' },
  yearly: { amount: 6000, currency: 'USD' },
};

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function diagnostics(keyId, keySecret) {
  const safeKeyId = keyId || '';
  const safeKeySecret = keySecret || '';
  return {
    keyIdStartsWith: safeKeyId.slice(0, 9),
    keyIdLength: safeKeyId.length,
    keySecretLength: safeKeySecret.length,
    mode: safeKeyId.startsWith('rzp_test_')
      ? 'test'
      : safeKeyId.startsWith('rzp_live_')
        ? 'live'
        : 'unknown',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
    return;
  }

  const plan = req.body?.plan;
  const selectedPlan = PLANS[plan];
  if (!selectedPlan) {
    sendJson(res, 400, { error: 'Invalid plan. Choose monthly or yearly.' });
    return;
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  const missingVariables = [];
  if (!keyId) missingVariables.push('RAZORPAY_KEY_ID');
  if (!keySecret) missingVariables.push('RAZORPAY_KEY_SECRET');
  if (missingVariables.length) {
    sendJson(res, 500, {
      error: `Missing environment variable${missingVariables.length > 1 ? 's' : ''}: ${missingVariables.join(', ')}.`,
      diagnostics: diagnostics(keyId, keySecret),
    });
    return;
  }

  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: selectedPlan.amount,
        currency: selectedPlan.currency,
        receipt: `audit-extractor-${Date.now()}`,
      }),
    });

    const order = await response.json();
    if (!response.ok) {
      sendJson(res, response.status, {
        error: order.error?.description || 'Could not create Razorpay order.',
        httpStatus: response.status,
        diagnostics: diagnostics(keyId, keySecret),
      });
      return;
    }

    sendJson(res, 200, {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (error) {
    console.error('Razorpay order creation failed', error);
    sendJson(res, 502, {
      error: 'Could not reach Razorpay. Please try again.',
      diagnostics: diagnostics(keyId, keySecret),
    });
  }
}
