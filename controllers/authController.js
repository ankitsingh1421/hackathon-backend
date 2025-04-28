import crypto from 'crypto';
import User from '../models/User.js';
import Token from '../models/Token.js';
import sendEmail from '../utils/sendEmail.js';
import { generateOTP, generateToken } from '../utils/helpers.js';
import ErrorResponse from '../utils/errorResponse.js';


export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return next(new ErrorResponse('Email already registered', 400));
    }

    // Generate 6-digit OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user with isVerified set to false
    const user = await User.create({
      name,
      email,
      password,
      isVerified: false,
      verificationOtp: otp,
      verificationOtpExpiry: otpExpiry,
    });

    // Send verification email
    const message = `
      <h1>Email Verification</h1>
      <p>Please use the verification code below to verify your email:</p>
      <h2>${otp}</h2>
      <p>This code will expire in 10 minutes</p>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Email Verification',
        html: message,
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful! Please check your email to verify your account.',
        userId: user._id,
      });
    } catch (error) {
      user.verificationOtp = undefined;
      user.verificationOtpExpiry = undefined;
      await user.save();

      return next(new ErrorResponse('Email could not be sent', 500));
    }

    re_Z8roZrc8_A9cXbgYmvYfGythvsKdDFFqZ


    
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email with OTP
// @route   POST /api/auth/verify-email
// @access  Public
export const verifyEmail = async (req, res, next) => {
  try {
    const { userId, otp } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Check if OTP matches and is not expired
    if (
      !user.verificationOtp ||
      user.verificationOtp !== otp ||
      user.verificationOtpExpiry < Date.now()
    ) {
      return next(new ErrorResponse('Invalid or expired verification code', 400));
    }

    // Update user to verified
    user.isVerified = true;
    user.verificationOtp = undefined;
    user.verificationOtpExpiry = undefined;
    await user.save();

    // Send a welcome email
    const message = `
      <h1>Welcome to Mental Health App!</h1>
      <p>Thank you for verifying your email. You can now log in to your account.</p>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Welcome to Mental Health App',
        html: message,
      });
    } catch (error) {
      console.error('Welcome email could not be sent', error);
      // Continue even if welcome email fails
    }

    res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend verification OTP
// @route   POST /api/auth/resend-verification
// @access  Public
export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return next(new ErrorResponse('User with this email does not exist', 404));
    }

    if (user.isVerified) {
      return next(new ErrorResponse('Email is already verified', 400));
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.verificationOtp = otp;
    user.verificationOtpExpiry = otpExpiry;
    await user.save();

    // Send verification email
    const message = `
      <h1>Email Verification</h1>
      <p>Please use the verification code below to verify your email:</p>
      <h2>${otp}</h2>
      <p>This code will expire in 10 minutes</p>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Email Verification',
        html: message,
      });

      res.status(200).json({
        success: true,
        message: 'Verification email resent successfully',
        userId: user._id,
      });
    } catch (error) {
      user.verificationOtp = undefined;
      user.verificationOtpExpiry = undefined;
      await user.save();

      return next(new ErrorResponse('Email could not be sent', 500));
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Check if email is verified
    if (!user.isVerified) {
      return next(new ErrorResponse('Please verify your email to log in', 401));
    }

    // Create token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenExpiry = Date.now() + 30 * 60 * 1000; // 30 minutes

    // Save reset token to database
    await Token.create({
      userId: user._id,
      token: resetToken,
      tokenType: 'password-reset',
      expiresAt: new Date(resetTokenExpiry),
    });

    // Create reset URL
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    // Send email
    const message = `
      <h1>Password Reset Request</h1>
      <p>You requested a password reset. Please click the link below to reset your password:</p>
      <a href="${resetUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>This link will expire in 30 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        html: message,
      });

      res.status(200).json({
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.',
      });
    } catch (error) {
      // Delete the token if email sending fails
      await Token.deleteOne({ userId: user._id, tokenType: 'password-reset' });
      return next(new ErrorResponse('Email could not be sent', 500));
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password/:resetToken
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const { resetToken } = req.params;
    const { password } = req.body;

    // Find token in database
    const token = await Token.findOne({
      token: resetToken,
      tokenType: 'password-reset',
      expiresAt: { $gt: Date.now() },
    });

    if (!token) {
      return next(new ErrorResponse('Invalid or expired token', 400));
    }

    // Get user
    const user = await User.findById(token.userId);
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Update password
    user.password = password;
    await user.save();

    // Delete token
    await Token.deleteOne({ _id: token._id });

    // Send confirmation email
    const message = `
      <h1>Password Reset Successful</h1>
      <p>Your password has been successfully reset. You can now log in with your new password.</p>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Successful',
        html: message,
      });
    } catch (error) {
      console.error('Password reset confirmation email could not be sent', error);
      // Continue even if confirmation email fails
    }

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};