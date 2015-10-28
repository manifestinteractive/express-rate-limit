'use strict';
var defaults = require('defaults');

function RateLimit(options) {

  options = defaults(options, {
    // window, delay, and max apply per-ip unless global is set to true
    windowMs: 60 * 1000, // milliseconds - how long to keep records of requests in memory
    delayAfter: 1, // how many requests to allow through before starting to delay responses
    delayMs: 1000, // milliseconds - base delay applied to the response - multiplied by number of recent hits from user's IP
    max: 5, // max number of recent connections during `window` miliseconds before sending a 429 response
    message: 'Too many requests, please try again later.',
    statusCode: 429 // 429 status = Too Many Requests (RFC 6585)
  });


  if (options.global) {
    throw new Error('The global option was removed from express-rate-limit v2.');
  }


  // this is shared by all endpoints that use this instance
  var hits = {};
  var rateStart = new Date();

  function rateLimit(req, res, next) {
    var ip = req.ip;

    if (hits[ip]) {
      hits[ip]++;
    } else {
      hits[ip] = 1;
    }

    var now = new Date();
    var rateReset = ( options.windowMs - ( now.getTime() - rateStart.getTime()))
    var rateRemaining = (options.max - hits[ip]);
    if(rateRemaining < 0){
      rateRemaining = 0;
    }

    res.setHeader('X-Rate-Limit-Limit', options.max);
    res.setHeader('X-Rate-Limit-Remaining', rateRemaining);
    res.setHeader('X-Rate-Limit-Reset', rateReset);

    if (options.max && hits[ip] > options.max) {

      // Add our original headers back in since they get removed:
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('X-Powered-By', 'Blackdove');

      var message = {
        error: true,
        error_messages: [
          {
            status: 429,
            message: 'Too Many Requests. Maximum of ' + options.max + ' API calls per ' + options.windowMs + ' milliseconds. Rate Reset in ' + rateReset + ' milliseconds.',
            rate: {
              window: options.windowMs,
              limit: options.max,
              overage: (hits[ip] - options.max),
              reset: rateReset
            }
          }
        ],
        meta: {
          total:1,
          showing: 1,
          pages: 1,
          page: 1
        },
        data:[]
      };

      return res.status(options.statusCode).end(JSON.stringify(message));
    }

    if (options.delayAfter && options.delayMs && hits[ip] > options.delayAfter) {
      var delay = (hits[ip] - options.delayAfter) * options.delayMs;
      setTimeout(next, delay);
    } else {
      next();
    }
  }

  function resetAll() {
    hits = {};
    rateStart = new Date();
  }

  // simply reset ALL hits every windowMs
  setInterval(resetAll, options.windowMs);

  // export an API to allow hits from one or all IPs to be reset

  function resetIp(ip) {
    delete hits[ip];
    rateStart = new Date();
  }

  rateLimit.resetIp = resetIp;

  return rateLimit;
}

module.exports = RateLimit;
