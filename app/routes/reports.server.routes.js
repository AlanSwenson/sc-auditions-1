'use strict';

module.exports = function(app) {
	var users = require('../../app/controllers/users');
	var reports = require('../../app/controllers/reports');

	// Reports Routes
	app.route('/reports')
		.get(reports.list)
		.post(users.requiresLogin, reports.create);

	// app.route('/reports/:reportId')
	// 	.get(reports.read)
	// 	.put(users.requiresLogin, reports.hasAuthorization, reports.update)
	// 	.delete(users.requiresLogin, reports.hasAuthorization, reports.delete);

	app.route('/reports/findMissingAuds')
		.post(users.requiresLogin, reports.findMissingAuds);

	app.route('/reports/findAuditionsBooked')
		.post(users.requiresLogin, reports.findAuditionsBooked);

	app.route('/reports/convertToCSV')
		.post(users.requiresLogin, reports.convertToCSV);

	// Finish by binding the Report middleware
	app.param('reportId', reports.reportByID);
};