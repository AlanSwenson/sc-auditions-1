'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
	errorHandler = require('./errors'),
	Project = mongoose.model('Project'),
	User = mongoose.model('User'),
	Talent = mongoose.model('Talent'),
	Typecast = mongoose.model('Typecast'),
	fs = require('fs'),
	_ = require('lodash'),
	path = require('path'),
	mv = require('mv'),
	nodemailer = require('nodemailer');

// process email submission
var procEmail = function(project){
	if(typeof project.email !== 'undefined' && project.email.length){
		var transporter = nodemailer.createTransport();
		transporter.sendMail({
		    from: project.email.from,
		    to: project.email.to,
		    subject: project.email.subject,
		    text: project.email.message
		});
	}

	// reset email object
	project.email = {};
};

/**
 * Create a Project
 */
exports.create = function(req, res) {
	var project = new Project(req.body);
	project.user = req.user;

	var allowedRoles = ['admin','producer/auditions director'];

	if (_.intersection(req.user.roles, allowedRoles).length) {
		project.save(function(err) {
			if (err) {
				return res.status(400).send({
					message: errorHandler.getErrorMessage(err)
				});
			} else {
				res.jsonp(project);

				// move new saved files from temp to project id based directory
				if(typeof project.scripts[0] !== 'undefined'){
					var appDir = path.dirname(require.main.filename);
				    var tempPath = appDir + '/public/res/scripts/temp/' + project.scripts[0].file.name;
				    var relativePath =  'res/scripts/' + project._id + '/';
				    var newPath = appDir + '/public/' + relativePath;

				    // create project directory if not found
				    if (!fs.existsSync(newPath)) {
				    	fs.mkdirSync(newPath);
				    }

				    console.log(project.scripts[0].file.name);

				    // add file path
				    newPath += project.scripts[0].file.name;

				    mv(tempPath, newPath, function(err) {
				        console.log(err);
				        if (err){
				            res.status(500).end();
				        }else{
				            res.status(200).end();
				        }
				    });
				}
			}
		});
	} else {
		return res.status(403).send('User is not authorized');
	}
};

/**
 * Show the current Project
 */
exports.read = function(req, res) {
	res.jsonp(req.project);
};


// remove file from local file system
var deleteFiles = function(project){
	
	var appDir = path.dirname(require.main.filename);

	for(var i = 0; i < project.deleteFiles.length; ++i){
		var file = appDir + '/public' + project.deleteFiles[i];

		// remove file is exists
		if (fs.existsSync(file)) {
			fs.unlinkSync(file);
			console.log(file + ' removed');
		}

		// remove file from delete queue
		project.deleteFiles.splice(i, 1);
	}

};

/**
 * Update a Project
 */
exports.update = function(req, res) {
	var project = req.project ;

	project = _.extend(project , req.body);

	// delete any files no longer in use
	deleteFiles(project);
	// send required emails as needed
	procEmail(project);

	project.save(function(err) {
		if (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {
			res.jsonp(project);
		}
	});
};

/**
 * Delete an Project
 */
exports.delete = function(req, res) {
	var project = req.project;

	// generate delete files list
	var delFilesLn = project.deleteFiles.length || 0;
	var i;
	for(i = 0; i < project.auditions.length; ++i){
		if(typeof project.auditions[i] !== 'undefined'){
			project.deleteFiles[delFilesLn] = '/res/auditions/' + project._id + '/' + project.auditions[i].file.name;
			delFilesLn++;
		}
	}
	for(i = 0; i < project.scripts.length; ++i){
		if(typeof project.scripts[i] !== 'undefined'){
			project.deleteFiles[delFilesLn] = '/res/scripts/' + project._id + '/' + project.scripts[i].file.name;
			delFilesLn++;
		}
	}

	// delete found files
	deleteFiles(project);

	project.remove(function(err) {
		if (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {
			res.jsonp(project);
		}
	});
};

/**
 * List of Projects
 */
exports.list = function(req, res) { Project.find().sort('-created').populate('user', 'displayName').exec(function(err, projects) {
		if (err) {
			return res.status(400).send({
				message: errorHandler.getErrorMessage(err)
			});
		} else {
			res.jsonp(projects);
		}
	});
};

/**
 * Project middleware
 */
exports.projectByID = function(req, res, next, id) { Project.findById(id).populate('user', 'displayName').exec(function(err, project) {
		if (err) return next(err);
		if (! project) return next(new Error('Failed to load Project ' + id));
		req.project = project ;
		next();
	});
};

/**
 * Project authorization middleware
 */
exports.hasAuthorization = function(req, res, next) {
	// recon 2/17/2015 to allow admin and producer level users to edit all projects
	var allowedRoles = ['admin','producer/auditions director'];

	if (_.intersection(req.user.roles, allowedRoles).length) {
		// do nothing
	} else {
		return res.status(403).send('User is not authorized');
	}
	next();
};

// file upload
exports.uploadFile = function(req, res, next){
	// We are able to access req.files.file thanks to 
    // the multiparty middleware
    var file = req.files.file;
    //console.log(file.name);
    //console.log(file.type);

    var project = JSON.parse(req.body.data);

    //var file = req.files.file;
    var appDir = path.dirname(require.main.filename);
    var tempPath = file.path;

    var relativePath =  'res' + '/' + project.project._id + '/';
    var newPath = appDir + '/public/' + relativePath;

    // create project directory if not found
    if (!fs.existsSync(newPath)) {
    	fs.mkdirSync(newPath);
    }

    // add file to path
    newPath += file.name;

    //console.log(newPath);

    mv(tempPath, newPath, function(err) {
        console.log(err);
        if (err){
            res.status(500).end();
        }else{
            res.status(200).end();
        }
    });
};

// file upload
exports.uploadScript = function(req, res, next){
	// We are able to access req.files.file thanks to 
    // the multiparty middleware
    var file = req.files.file;
    //console.log(file.name);
    //console.log(file.type);

    var project = JSON.parse(req.body.data);

    //var file = req.files.file;
    var appDir = path.dirname(require.main.filename);
    var tempPath = file.path;
    var relativePath =  'res' + '/' + 'scripts' + '/' + project.project._id + '/';
    var newPath = appDir + '/public/' + relativePath;

    // create project directory if not found
    if (!fs.existsSync(newPath)) {
    	fs.mkdirSync(newPath);
    }

    // add file path
    newPath += file.name;

    //console.log(newPath);

    mv(tempPath, newPath, function(err) {
        console.log(err);
        if (err){
            res.status(500).end();
        }else{
            res.status(200).end();
        }
    });
};

// file upload
exports.uploadTempScript = function(req, res, next){
	// We are able to access req.files.file thanks to 
    // the multiparty middleware
    var file = req.files.file;
    //console.log(file.name);
    //console.log(file.type);

    var project = JSON.parse(req.body.data);

    //var file = req.files.file;
    var appDir = path.dirname(require.main.filename);
    var tempPath = file.path;
    var relativePath =  'res' + '/' + 'scripts' + '/temp/';
    var newPath = appDir + '/public/' + relativePath;

    // add file path
    newPath += file.name;

    //console.log(newPath);

    mv(tempPath, newPath, function(err) {
        console.log(err);
        if (err){
            res.status(500).end();
        }else{
            res.status(200).end();
        }
    });
};

// file upload
exports.uploadAudition = function(req, res, next){
	// We are able to access req.files.file thanks to 
    // the multiparty middleware
    var file = req.files.file;
    //console.log(file.name);
    //console.log(file.type);

    var project = JSON.parse(req.body.data);

    //var file = req.files.file;
    var appDir = path.dirname(require.main.filename);
    var tempPath = file.path;
    var relativePath =  'res' + '/' + 'auditions' + '/' + project.project._id + '/';
    var newPath = appDir + '/public/' + relativePath;

    // create project directory if not found
    if (!fs.existsSync(newPath)) {
    	fs.mkdirSync(newPath);
    }

    // add file path
    newPath += file.name;

    //console.log(newPath);

    mv(tempPath, newPath, function(err) {
        console.log(err);
        if (err){
            res.status(500).end();
        }else{
            res.status(200).end();
        }
    });
};