require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected for seeding');

    const email = 'gumansingh.oditechglobal@gmail.com';
    
    // Check if the user already exists
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      console.log('Super admin already exists in the database.');
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('123456', salt);

    // Create new super admin
    const superAdmin = new User({
      email,
      password: hashedPassword,
      role: 'super_admin'
    });

    await superAdmin.save();
    console.log('Super admin created successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error seeding super admin:', error);
    process.exit(1);
  }
};

seedSuperAdmin();
