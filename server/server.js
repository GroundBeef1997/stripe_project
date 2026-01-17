require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// List all products with their prices
app.get('/api/products', async (req, res) => {
  try {
    const products = await stripe.products.list({
      active: true,
      expand: ['data.default_price'],
      limit: 100
    });
    res.json(products.data);
  } catch (error) {
    console.error('Error fetching products:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Get single product details
app.get('/api/products/:productId', async (req, res) => {
  try {
    const product = await stripe.products.retrieve(req.params.productId, {
      expand: ['default_price']
    });
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Get price details
app.get('/api/prices/:priceId', async (req, res) => {
  try {
    const price = await stripe.prices.retrieve(req.params.priceId);
    res.json(price);
  } catch (error) {
    console.error('Error fetching price:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Create payment intent
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, paymentMethodId, productId } = req.body;

    // Create a PaymentIntent with the payment method
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      metadata: {
        productId: productId
      }
    });

    res.json({
      success: true,
      paymentIntent: paymentIntent
    });
  } catch (error) {
    console.error('Payment error:', error.message);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', stripe: !!process.env.STRIPE_SECRET_KEY });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Stripe configured: ${process.env.STRIPE_SECRET_KEY ? 'Yes' : 'No - Add STRIPE_SECRET_KEY to .env'}`);
});
