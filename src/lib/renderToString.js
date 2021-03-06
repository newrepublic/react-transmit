/**
 * @copyright © 2015, Rick Wong. All rights reserved.
 */
"use strict";

var promiseProxy = require("./promiseProxy");
var React        = require("./react");
var ReactDOMServer = require('react-dom/server');

/**
 * @function renderToString
 */
module.exports = function (Component, props) {
	props = props || {};

	return new promiseProxy.Promise(function (resolve, reject) {
		var onQuery = function (promise) {
			promise.then(function (queryResults) {
				var myProps     = Object.assign({}, props, queryResults);
				var reactString = ReactDOMServer.renderToString(React.createElement(Component, myProps))

				resolve({
					reactString: reactString,
					reactData:   queryResults
				});
			}).catch(function (error) {
				reject(error);
			});
		};

		var myProps = Object.assign({}, props, {onQuery: onQuery});
		ReactDOMServer.renderToString(React.createElement(Component, myProps));
	});
};
