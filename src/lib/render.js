/**
 * @copyright © 2015, Rick Wong. All rights reserved.
 */
"use strict";

var React  = require("./react");

/**
 * @function render
 */
module.exports = function (Component, props, targetDOMNode, callback) {
	var myProps = Object.assign({}, props, window.__reactTransmitPacket || {});

	if (window.__reactTransmitPacket) {
		delete window.__reactTransmitPacket;
	}

	React.render(React.createElement(Component, myProps), targetDOMNode, callback);
};
