var customer = module.exports = {};
var Org = require('../agents/org');
var utils = require('../lib/utils');

customer.getBillingInfo = function (request, reply) {

  var opts = {
    title: 'Billing',
    updated: ('updated' in request.query),
    canceled: ('canceled' in request.query),
    stripePublicKey: process.env.STRIPE_PUBLIC_KEY,
    features: {
      orgs: request.features.org_billing
    }
  };

  // Display a message to unpaid collaborators about the
  // package they could be accessing if they paid for it
  if (request.query.package) {
    opts.package = request.query.package;
  }

  request.customer.get(function(err, customer) {

    if (customer) {
      opts.customer = customer;
    }

    request.customer.getSubscriptions(function (err, subscriptions) {
      if (err) {
        request.logger.error('unable to get subscriptions for ' + request.loggedInUser.name);
        request.logger.error(err);
        subscriptions = [];
      }

      opts.subscriptions = subscriptions;

      return reply.view('user/billing', opts);
    });
  });
};

customer.updateBillingInfo = function(request, reply) {
  var sendToHubspot = request.server.methods.npme.sendData;

  var coupon = request.payload.coupon;

  var billingInfo = {
    name: request.loggedInUser.name,
    email: request.loggedInUser.email,
    card: request.payload.stripeToken,
  };

  if (coupon) {
    billingInfo.coupon = coupon.toLowerCase();
  }

  request.customer.updateBilling(billingInfo, function(err) {
    var opts = {};

    if (err) {
      opts.errors = [];
      opts.errors.push(new Error(err));
      return reply.view('user/billing', opts);
    }

    var data = {
      hs_context: {
        pageName: "customer-billing-update",
        ipAddress: utils.getUserIP(request)
      },
      email: billingInfo.email
    };

    sendToHubspot(process.env.HUBSPOT_FORM_PRIVATE_NPM_SIGNUP, data, function (er) {
      if (er) {
        request.logger.error('unable to send billing email to HubSpot');
        request.logger.error(er);
      }

      return reply.redirect('/settings/billing?updated=1');
    });
  });

};

customer.deleteBillingInfo = function(request, reply) {

  request.customer.del(function(err, customer) {
    if (err) {
      request.logger.error("unable to delete billing info for " + customer);
      request.logger.error(err);
      return reply.view('errors/internal').code(500);
    }
    return reply.redirect('/settings/billing?canceled=1');
  });
};

var plans = {
  private_modules: 'npm-paid-individual-user-7',
  orgs: 'npm-paid-org-6'
};

customer.subscribe = function (request, reply) {
  var planType = request.payload.planType;

  var planInfo = {
    plan: plans[planType]
  };

  if (planType === 'orgs') {
    planInfo.npm_org = request.payload.orgName;
  }

  if (request.features.org_billing) {
    var opts = {};

    Org(request.loggedInUser.name)
      .get(planInfo.npm_org, function (err, users) {
        if (users) {
          opts.errors = [];
          opts.errors.push(new Error("Error: Org already exists."));
          return reply.view('user/billing', opts);
        }

        if (err.statusCode === 404) {
          // org doesn't yet exist
          request.customer.createSubscription(planInfo, function (err, subscriptions) {
            if (err) {
              request.logger.error("unable to update subscription to " + planInfo.plan);
              request.logger.error(err);
            }

            if (typeof subscriptions === 'string') {
              request.logger.info("created subscription: ", planInfo);
            }

            Org(request.loggedInUser.name)
              .create(planInfo.npm_org, function (err, opts){
                if (err) {
                  return reply.view('error/internal', err);
                }

                return reply.redirect('/settings/billing', opts);
              });

          });
        } else {
          // do actual error handling here
          opts.errors = [];
          opts.errors.push(new Error(err));
          request.logger.error(err);
          return reply.view('user/billing', opts);
        }
      });
  } else {
    request.customer.createSubscription(planInfo, function (err, subscriptions) {
      if (err) {
        request.logger.error("unable to update subscription to " + planInfo.plan);
        request.logger.error(err);
      }

      if (typeof subscriptions === 'string') {
        request.logger.info("created subscription: ", planInfo);
      }

      return reply.redirect('/settings/billing');
    });
  }

};

customer.updateOrg = function (request, reply) {
  var orgName = request.params.org;
  var loggedInUser = request.loggedInUser.name;
  var user = {
    user: request.payload.username,
    role: request.payload.role
  };
  var opts = {};

  if (request.payload.updateType === "addUser") {
  Org(loggedInUser)
    .addUser(orgName, user, function (err, addedUser) {
      if (err) {
        request.logger.error(err);
        return reply.view('errors/internal', err);
      }
      request.customer.getLicense(loggedInUser, function(err, license) {
        if (err) {
          request.logger.error(err);
          return reply.view('errors/internal', err);
        }
        console.log(license.id);
        request.customer.extendSponsorship(license.id, addedUser, function(err, sponsorship) {
          if (err) {
            request.logger.error(err);
            return reply.view('errors/internal', err);
          }
          request.customer.acceptSponsorship(sponsorship.verification_key, function(err, sponsorship) {
            if (err) {
              request.logger.error(err);
              return reply.view('errors/internal', err);
            }
            Org(loggedInUser)
              .get(orgName, function (err, org) {
                if (err) {
                  request.logger.error(err);
                  return reply.view('errors/internal', err);
                }
                opts.org = org;
                return reply.view('org/info', opts);
              });
          });
        });
      });

    });
  } else if (request.payload.updateType === "deleteUser") {
    Org(loggedInUser)
      .removeUser(orgName, user.user, function (err, removedUser) {
        if (err) {
          request.logger.error(err);
          return reply.view('errors/internal', err);
        }
        Org(loggedInUser)
          .get(orgName, function (err, org) {
            if (err) { request.logger.error(err); }
            opts.org = org;
            return reply.view('org/info', opts);
          });
      });
  }


};
