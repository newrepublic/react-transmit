/**
 * @copyright © 2015, Rick Wong. All rights reserved.
 */
"use strict";

var promiseProxy = require("./promiseProxy");
var React        = require("./react");
var PropTypes = require("prop-types")
var createReactClass = require('create-react-class');

function isRootContainer(Container) {
	return !!Container.isRootContainer;
};

function shallowEqual(a, b) {
	var ka = 0;
	var kb = 0;
	for (var key in a) {
		if (a.hasOwnProperty(key) && a[key] !== b[key])
			return false;
    		ka++;
  	}
  	for (var keyb in b)
  		if (b.hasOwnProperty(keyb))
      			kb++;
  	return ka === kb;
}

/**
 * @function createContainer
 */
module.exports = function (Component, options) {
	options = arguments[1] || {};

	var Container = createReactClass({
		displayName: (Component.displayName || Component.name) + "Container",
		propTypes: {
			queryParams: PropTypes.object,
			onQuery:     PropTypes.func,
			emptyView:   PropTypes.oneOfType([
				PropTypes.element,
				PropTypes.func
	        ])
		},
		statics: {
			isRootContainer: !!options.initialVariables,
			queryParams: options.queryParams || {},
			queries:     options.queries || {},
			getQuery:    function (queryName, queryParams) {
				if (!Container.queries[queryName]) {
					throw new Error(Component.displayName + " has no '" + queryName +"' query")
				}

				queryParams = queryParams || {};
				Object.assign(queryParams, Container.queryParams, Object.assign({}, queryParams));

				return Container.queries[queryName](queryParams);
			},
			getAllQueries: function (queryParams, optionalQueryNames) {
				var promises = [];
				optionalQueryNames = optionalQueryNames || [];

				if (typeof optionalQueryNames === "string") {
					optionalQueryNames = [optionalQueryNames];
				}

				Object.keys(Container.queries).forEach(function (queryName) {
					if (optionalQueryNames.length && optionalQueryNames.indexOf(queryName) < 0) {
						return;
					}

					var promise = Container.getQuery(
						queryName, queryParams
					).then(function (queryResult) {
						var queryResults = {};
						queryResults[queryName] = queryResult;

						return queryResults;
					});

					promises.push(promise);
				});

				if (!promises.length) {
					promises.push(promiseProxy.Promise.resolve(true));
				}

				return promiseProxy.Promise.all(
					promises
				).then(function (promisedQueries) {
					var queryResults = {};

					promisedQueries.forEach(function (promisedQuery) {
						if (typeof promisedQuery === "object") {
							Object.assign(queryResults, promisedQuery);
						}
					});

					return queryResults;
				});
			}
		},
		componentWillMount: function () {
			var externalQueryParams = this.props && this.props.queryParams || {};

			this.currentParams = Object.assign({}, Container.queryParams, externalQueryParams);

			if (!this.hasQueryResults()) {
				this.setQueryParams({});
			}
			else if (this.props.onQuery) {
				this.props.onQuery.call(this, promiseProxy.Promise.resolve({}));
			}
		},
		componentDidUpdate: function(prevProps) {
			/**
			 * This implementation is adapted from:
			 * https://github.com/RickWong/react-transmit/issues/31
			 */
			var needToLoad = !shallowEqual(
				prevProps.queryParams,
				this.props.queryParams
			);
			if (isRootContainer(Container) && needToLoad) {
				/**
				 * Clear existing data so that we get a "fresh screen"
				 * and all the child components get re-mounted.
				 */
				this.setState({loading: true})
				/**
				 * Load data from scratch.
				 */
				var externalQueryParams = this.props && this.props.queryParams || {};

				this.currentParams = Object.assign({}, Container.queryParams, externalQueryParams);
				this.setQueryParams({});
			}
		},
    componentDidMount: function () {
			// Keep track of the mounted state manually, because the official isMounted() method
			// returns true when using renderToString() from react-dom/server.
			this._mounted = true;
		},

		componentWillUnmount: function () {
			this._mounted = false;
		},

		_isMounted: function () {
			// See the official `isMounted` discussion at https://github.com/facebook/react/issues/2787
			return !!this._mounted;
		},

		setQueryParams: function (nextParams, optionalQueryNames) {
			var _this = this;

			var promise = new promiseProxy.Promise(function (resolve, reject) {
				var props = _this.props || {};
				var promise;

				Object.assign(_this.currentParams, nextParams);
				promise = Container.getAllQueries(_this.currentParams, optionalQueryNames);

				promise.then(function (queryResults) {
					// See `isMounted` discussion at https://github.com/facebook/react/issues/2787
					if (!_this._isMounted()) {
						return queryResults;
					}

					try {
						_this.setState(Object.assign({}, queryResults, {loading: false}));
					}
					catch (error) {
						// Call to setState may fail if renderToString() was used.
						if (!error.message || !error.message.match(/^document/)) {
							throw error;
						}
					}

					return queryResults;
				});

				resolve(promise);
			});

			if (this.props.onQuery) {
				this.props.onQuery.call(this, promise);
			}

			return promise;
		},
		/**
		 * @returns {boolean} true if all queries have results.
		 */
		hasQueryResults: function () {
			var state = this.state || {};
			var props = this.props || {};

			if (!Object.keys(Container.queries).length) {
				return true;
			}

			for (var queryName in Container.queries) {
				if (!Container.queries.hasOwnProperty(queryName) ||
				    props.hasOwnProperty(queryName) ||
				    state.hasOwnProperty(queryName)) {
					continue;
				}

				return false;
			}

			return true;
		},
		/**
		 * @returns {ReactElement} or null
		 */
		render: function () {
			var state     = this.state || {};
			var props     = this.props || {};
			var utilProps = {
				queryParams:    this.currentParams,
				setQueryParams: this.setQueryParams,
				onQuery:        undefined
			};

			// Query results must be guaranteed to render.
			if (!this.hasQueryResults() || state.loading) {
				return (typeof props.emptyView === "function") ?
				       props.emptyView() :
				       props.emptyView || null;
			}

			return React.createElement(
				Component,
				Object.assign({}, props, state, utilProps)
			);
		}
	});

	return Container;
};
