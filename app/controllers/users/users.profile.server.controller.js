'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
	errorHandler = require('../errors'),
	mongoose = require('mongoose'),
	passport = require('passport'),
	User = mongoose.model('User'),
	config = require('../../../config/config'),
	nodemailer = require('nodemailer');

/**
 * Update user details
 */
exports.update = function(req, res) {
	// Init Variables
	var user = req.user;
	var message = null;

	// For security measurement we remove the roles from the req.body object
	delete req.body.roles;

	if (user) {
		// Merge existing user
		user = _.extend(user, req.body);
		user.updated = Date.now();
		user.displayName = user.firstName + ' ' + user.lastName;

		user.save(function(err) {
			if (err) {
				return res.status(400).send({
					message: errorHandler.getErrorMessage(err)
				});
			} else {
				req.login(user, function(err) {
					if (err) {
						res.status(400).send(err);
					} else {
						res.jsonp(user);
					}
				});
			}
		});
	} else {
		res.status(400).send({
			message: 'User is not signed in'
		});
	}
};

exports.updateAdmin = function(req, res) {
	// Init Variables
	//var message = null;
	//var user = req.user;
	// For security measurement we remove the roles from the req.body object
	//delete req.body.roles;
	//console.log(user);
	//console.log(req.body);
	var adminUserId = req.user._id;

	// load edited user data
	User.findById(req.body._id).populate('user', 'displayName').exec(function(err, user) {
		if (user) {
			// Merge existing user
			user = _.extend(user, req.body);
			user.updated = Date.now();
			user.displayName = user.firstName + ' ' + user.lastName;
			user.edited = '';

			user.save(function(err) {
				if (err) {
					return res.status(400).send({
						message: errorHandler.getErrorMessage(err)
					});
				} else {

					var transporter = nodemailer.createTransport(config.mailer.options);
					
					// configure email body
					var emailBody = 'First Name: ' + user.firstName + '\n';
					emailBody += 'Last Name: ' + user.lastName + '\n';
					emailBody += 'Email: ' + user.email + '\n';
					emailBody += 'Username: ' + user.username + '\n';

					// send email notification of update
					transporter.sendMail({
					    from: config.mailer.from,
					    to: user.email,
					    subject: 'SC Auditions ' + user.displayName + ' account update',
					    text: emailBody
					});

					// reload admin user data
					User.findById(adminUserId).populate('user', 'displayName').exec(function(err, user) {
						req.login(user, function(err) {
							if (err) {
								res.status(400).send(err);
							} else {
								res.jsonp(user);
							}
						});
					});
				}
			});
		}
	});
};

/**
 * Send User
 */
exports.me = function(req, res) {
	res.jsonp(req.user || null);
};
// 2/20/2015
// added for admin user purposes
exports.list = function(req, res) { User.find().sort('-created').populate('user', 'displayName').exec(function(err, users) {
		if (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {
			res.jsonp(users);
		}
	});
};
exports.getListLevel = function(req, res, next, id) { 
	User.find({'roles':id}).sort('-created').populate('user', 'displayName').exec(function(err, users) {
		if (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {
			res.jsonp(users);
		}
	});
};

/**
 * Show the current user
 */
exports.read = function(req, res) {
	res.jsonp(req.profile);
};
exports.readAdmin = function(req, res) {
	res.jsonp(req.useredit);
};

exports.delete = function(req, res) {
	var user = req.useredit ;

	user.remove(function(err) {
		if (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {
			res.jsonp(user);
		}
	});
};

// allow admin user to create account 
exports.create = function(req, res) {
	
	// For security measurement we remove the roles from the req.body object
	var adminUserId = req.user._id;

	// define email signature
	var emailSig = '';
	if(req.user.emailSignature){
		emailSig = req.user.emailSignature;
	} else {
		emailSig = '';
	}

	// store admins email address
	var adminEmail = req.user.email;

	// Init Variables
	var user = new User(req.body);
	var message = null;

	// Add missing user fields
	user.provider = 'local';
	user.displayName = user.firstName + ' ' + user.lastName;

	// Then save the user 
	user.save(function(err) {
		if (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {

			// emailSubject = 'Your First Batch of ' + req.body.project.title + '  Auditions - Studio Center';

			// template = 'templates/users/client-welcome-email';

			// // send new user email
			// res.render(template, {
			// 	emailSignature: emailSig,
			// 	user: user,
			// 	audURL: 'http://' + req.headers.host,
			// }, function(err, clientEmailHTML) {
				
			// 	var mailOptions = {
			// 		to: user.email,
			// 		from: adminEmail || config.mailer.from,
			// 		replyTo: adminEmail || config.mailer.from,
			// 		subject: emailSubject,
			// 		html: clientEmailHTML
			// 	};

			// 	transporter.sendMail(mailOptions, function(){
			// 		done(err);
			// 	});

			// });

			// Remove sensitive data before login
			user.password = undefined;
			user.salt = undefined;

			req.login(user, function(err) {
				if (err) {
					res.status(400).send(err);
				} else {
					// reload admin user data
					User.findById(adminUserId).populate('user', 'displayName').exec(function(err, user) {
						req.login(user, function(err) {
							if (err) {
								res.status(400).send(err);
							} else {
								// return user json object
								res.jsonp(user);
							}
						});
					});
				}
			});
		}
	});
};