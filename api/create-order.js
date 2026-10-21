const PLANS = {
  monthly: { amount: 1000, currency: 'USD' },
  yearly: { amount: 6000, currency: 'USD' },
};

function sendJson(res, status, body) {
  res.status(status).json(body);
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

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    sendJson(res, 500, { error: 'Razorpay is not configured on the server.' });
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
      sendJson(res, response.status, { error: order.error?.description || 'Could not create Razorpay order.' });
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
    sendJson(res, 502, { error: 'Could not reach Razorpay. Please try again.' });
  }
}
