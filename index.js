
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();





// defining origin,and methods
const corsOption = {
  // defining origin,and methods
      origin:["https://ecommerce-frontend-ochre-two.vercel.app/"],
      methods:"GET,POST,PUT,DELETE,PATCH,HEAD",
      allowedHeaders:["Content-Type", "Authorization"],
      credentials:true
  }


// Middleware
app.use(cors());
app.options("*", cors(corsOption));
app.use(express.json());

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// Define schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  address: { type: String, required: true },
  avatarUrl: { type: String, required: true },
  isAdmin: { type: Boolean, required: true, default: false },
  createdAt: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, required: true },
  rating: { type: Number, required: true },
  numReviews: { type: Number, required: true },
  category: { type: String, required: true },
});

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  orderItems: [
    {
      name: { type: String, required: true },
      qty: { type: Number, required: true },
      image: { type: String, required: true },
      price: { type: Number, required: true },
      product: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' }
    }
  ],
  shippingInfo: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
    state: { type: String, required: true },
    phone: { type: String, required: true }
  },
  paymentMethod: { type: String, required: true },
  taxPrice: { type: Number, required: true, default: 0.0 },
  shippingPrice: { type: Number, required: true, default: 0.0 },
  totalPrice: { type: Number, required: true, default: 0.0 },
  isPaid: { type: Boolean, required: true, default: false },
  paidAt: { type: Date },
  isDelivered: { type: Boolean, required: true, default: false },
  deliveredAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);

// Auth middleware (Fixed Token Extraction)
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1]; // Extract token properly
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      return next(); // Ensure it exits function after calling next()
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  return res.status(401).json({ message: 'Not authorized, no token' });
};

// Admin middleware
const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  return res.status(401).json({ message: 'Not authorized as an admin' });
};

// User routes
app.post('/api/users/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    return res.status(201).json({ user, token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server Error' });
  }
});

app.post('/api/users/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      return res.json({ user, token });
    }

    return res.status(401).json({ message: 'Invalid email or password' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server Error' });
  }
});




// products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({});
    return res.json(products);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server Error' });
  }
});

//get single products

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      return res.json(product); // Fixed: Send response when product is found
    }
    return res.status(404).json({ message: 'Product not found' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server Error' });
  }
});


// POST create product
app.post('/api/products', async (req, res) => {
  try {
    const products = new Product(req.body);
    const saved = await products.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: 'Failed to add product', error: err });
  }
});

// PUT update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update product', error: err });
  }
});

// DELETE product
app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(400).json({ message: 'Failed to delete product', error: err });
  }
});




//my orders

app.get('/api/orders/myorders', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id });
    return res.json(orders);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server Error' }); // Fixed: Added response for errors
  }
});

// order creation  in database

app.post('/api/orders', protect, async (req, res) => {
  try {
    console.log("Order Request Body:", req.body);

    const { orderItems, shippingInfo, paymentMethod, taxPrice, shippingPrice, totalPrice } = req.body;

    if (!orderItems || orderItems.length === 0) {
      console.log("No order items found in request!");
      return res.status(400).json({ message: 'No order items' });
    }

    console.log("Creating order for user:", req.user._id);

    const order = new Order({
      user: req.user._id,  // Comes from `protect` middleware
      orderItems,
      shippingInfo,
      paymentMethod,
      taxPrice,
      shippingPrice,
      totalPrice,
      isPaid: false,
      isDelivered: false
    });

    const createdOrder = await order.save();
    console.log(" Order Created Successfully:", createdOrder);

    res.status(201).json(createdOrder);
  } catch (error) {
    console.error(" Order creation failed:", error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});















// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  connectDB();
});
