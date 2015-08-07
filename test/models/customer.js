var Code = require('code'),
    Lab = require('lab'),
    lab = exports.lab = Lab.script(),
    describe = lab.experiment,
    beforeEach = lab.beforeEach,
    before = lab.before,
    after = lab.after,
    it = lab.test,
    expect = Code.expect,
    nock = require("nock"),
    fixtures = require('../fixtures');

var CustomerModel = require("../../models/customer");

var LICENSE_API_OLD;
before(function (done) {
  LICENSE_API_OLD = process.env.LICENSE_API;
  process.env.LICENSE_API = "https://customer.com";
  done();
});

after(function (done) {
  process.env.LICENSE_API = LICENSE_API_OLD;
  done();
});

describe("Customer", function(){

  describe("initialization", function() {
    it("throws if a name is not passed", function (done) {
      expect(function () { return new CustomerModel();}).to.throw("Must pass a name to Customer model");
      done();
    });

    it("throws if a name is not passed but options are", function (done) {
      expect(function () { return new CustomerModel({host: "https://boom.com"});}).to.throw("Must pass a name to Customer model");
      done();
    });

    it("defaults to process.env.LICENSE_API as host", function(done) {
      expect(new CustomerModel('bob').host).to.equal('https://customer.com');
      done();
    });

    it("accepts a custom host", function(done) {
      var url = "https://billing-envy.com";
      var Customer = new CustomerModel('boom', {
        host: url,
      });

      expect(Customer.host).to.equal(url);
      done();
    });

    it("doesn't break if we forget the `new` keyword", function (done) {
      var Customer = CustomerModel('bob');
      expect(Customer.host).to.equal('https://customer.com');
      done();
    });

  });

  describe("get()", function() {

    it("makes an external request for /customer/{user}", function(done) {
      var Customer = new CustomerModel('haxor');

      var customerMock = nock(Customer.host)
        .get('/customer/haxor/stripe')
        .reply(200, fixtures.customers.happy);

      Customer.get(function(err, body) {
        customerMock.done();
        expect(err).to.be.null();
        done();
      });
    });

    it("returns the response body in the callback", function(done) {
      var Customer = new CustomerModel('zozo');

      var customerMock = nock(Customer.host)
        .get('/customer/zozo/stripe')
        .reply(200, fixtures.customers.happy);

      Customer.get(function(err, body) {
        customerMock.done();
        expect(err).to.be.null();
        expect(body).to.be.an.object();
        done();
      });
    });

    it("returns an error in the callback if customer doesn't exist", function(done) {
      var Customer = new CustomerModel('foo');

      var customerMock = nock(Customer.host)
        .get('/customer/foo/stripe')
        .reply(404);

      Customer.get(function(err, body) {
        customerMock.done();
        expect(err).to.exist();
        expect(err.message).to.equal("customer not found: foo");
        expect(err.statusCode).to.equal(404);
        done();
      });
    });

  });

  describe("updateBilling()", function() {

    describe("new customer", function() {
      var billingInfo;
      var Customer;

      beforeEach(function(done) {
        Customer = new CustomerModel('bob');

        billingInfo = {
          name: "bob",
          email: "bob@domain.com",
          card: "1234567890"
        };
        done();
      });

      it("makes an external request for /stripe/{user}", function(done) {
        var customerMock = nock(Customer.host)
          .get('/customer/bob/stripe')
          .reply(404)
          .put('/customer/stripe', billingInfo)
          .reply(200, fixtures.customers.happy);

        Customer.updateBilling(billingInfo, function(err, body) {
          customerMock.done();
          expect(err).to.be.null();
          expect(body).to.exist();
          done();
        });
      });

      it("gets customer data back in callback body", function(done) {
        var customerMock = nock(Customer.host)
          .get('/customer/bob/stripe')
          .reply(404)
          .put('/customer/stripe', billingInfo)
          .reply(200, fixtures.customers.happy);

        Customer.updateBilling(billingInfo, function(err, customer) {
          customerMock.done();
          expect(err).to.be.null();
          expect(customer).to.exist();
          expect(customer.email).to.equal("bencoe@gmail.com");
          done();
        });
      });

      it("errors if name is missing", function(done){
        delete billingInfo.name;
        Customer.updateBilling(billingInfo, function(err, customer) {
          expect(err).to.exist();
          expect(err.message).to.equal("name is a required property");
          done();
        });
      });

      it("errors if email is missing", function(done){
        delete billingInfo.email;
        Customer.updateBilling(billingInfo, function(err, customer) {
          expect(err).to.exist();
          expect(err.message).to.equal("email is a required property");
          done();
        });
      });

      it("errors if card is missing", function(done){
        delete billingInfo.card;
        Customer.updateBilling(billingInfo, function(err, customer) {
          expect(err).to.exist();
          expect(err.message).to.equal("card is a required property");
          done();
        });
      });

      it("errors if the card is invalid", function(done) {
        var createCustomerMock = nock(Customer.host)
          .get('/customer/bob/stripe')
          .reply(200, {})
          .post('/customer/bob/stripe', billingInfo)
          .reply(200, "Your card's security code is incorrect.");

        Customer.updateBilling(billingInfo, function (err, customer) {
          createCustomerMock.done();
          expect(err).to.exist();
          expect(err.message).to.equal("Your card's security code is incorrect.");
          done();
        });
      });
    });
  });

  describe("del()", function() {
    it("cancels a user's subscription", function (done) {
      var Customer = new CustomerModel('bob');
      var createCustomerMock = nock(Customer.host)
        .delete('/customer/bob/stripe')
        .reply(200, 'customer deleted');

      Customer.del(function (err, response) {
        createCustomerMock.done();
        expect(err).to.not.exist();
        expect(response).to.equal("customer deleted");
        done();
      });
    });
  });

  describe("createSubscription()", function () {
    it("signs a user up for private modules", function (done) {
      var Customer = new CustomerModel('bob');
      var planInfo = {plan: 'npm-paid-individual-user-7'};
      var customerMock = nock(Customer.host)
        .put('/customer/bob/stripe/subscription', planInfo)
        .reply(200, {
          id: 'sub_12345',
          current_period_end: 1436995358,
          current_period_start: 1434403358,
          quantity: 1,
          status: 'active',
          interval: 'month',
          amount: 700,
          license_id: 1,
          npm_org: '_private-modules-bob',
          npm_user: 'bob',
          product_id: '1031405a-70b7-4a3f-b552-8609d9e1428f'
        });

      Customer.createSubscription(planInfo, function (err, subscription) {
        customerMock.done();
        expect(err).to.not.exist();
        expect(subscription.id).to.equal('sub_12345');
        expect(subscription.npm_org).to.equal('_private-modules-bob');
        done();
      });

    });

    it("signs a user up for an org", function (done) {
      var Customer = new CustomerModel('bob');
      var planInfo = {plan: 'npm-paid-org-7'};
      var customerMock = nock(Customer.host)
        .put('/customer/bob/stripe/subscription', planInfo)
        .reply(200, {
          id: 'sub_12346',
          current_period_end: 1436995358,
          current_period_start: 1434403358,
          quantity: 2,
          status: 'active',
          interval: 'month',
          amount: 1200,
          license_id: 1,
          npm_org: 'bigco',
          npm_user: 'bob',
          product_id: '1031405a-70b7-4a3f-b552-8609d9e1428e'
        });
      Customer.createSubscription(planInfo, function (err, subscription) {
        customerMock.done();
        expect(err).to.not.exist();
        expect(subscription.id).to.equal('sub_12346');
        expect(subscription.npm_org).to.equal('bigco');
        done();
      });
    });

  });

  describe("getLicense", function () {
    it('returns an empty array if no customer with that name exists', function (done) {
      var Customer = new CustomerModel('billybob');
      var customerMock = nock(Customer.host)
        .get('/customer/billybob/license')
        .reply(200, []);

      Customer.getLicense(function (err, license) {
        customerMock.done();
        expect(err).to.not.exist();
        expect(license).to.be.array();
        expect(license.length).to.equal(0);
        done();
      });
    });

    it('returns an array with the customer license info in it', function (done) {
      var Customer = new CustomerModel('bob');
      var customerMock = nock(Customer.host)
        .get('/customer/bob/license')
        .reply(200, [
          {
            "begins": "2015-06-14T18:19:53.082Z",
            "canceled": null,
            "created": "2015-06-19T18:19:51.456Z",
            "customer_id": 999,
            "ends": "2015-08-19T18:20:53.000Z",
            "expired": false,
            "id": 135,
            "license_key": null,
            "npm_org": "_private-modules-bob",
            "npm_user": "bob",
            "plan_id": 1,
            "seats": 1,
            "stripe_subscription_id": "sub_6SOulW19lULlyx",
            "updated": "2015-07-19T19:47:41.707Z"
          }
        ]);

      Customer.getLicense(function (err, license) {
        customerMock.done();
        expect(err).to.not.exist();
        expect(license).to.be.array();
        expect(license.length).to.equal(1);
        expect(license[0].npm_user).to.equal("bob");
        expect(license[0].customer_id).to.equal(999);
        done();
      });
    });
  });

  describe("getLicenseIdForOrg", function () {
    it('returns an error if there is no org with that name', function (done) {
      var Customer = new CustomerModel('bob');
      var customerMock = nock(Customer.host)
        .get('/customer/bob/stripe/subscription')
        .reply(404);

      Customer.getLicenseIdForOrg('bigco', function (err, licenseId) {
        customerMock.done();
        expect(err).to.exist();
        expect(err.message).to.equal('No org with that name exists');
        expect(licenseId).not.exist();
        done();
      });
    });

    it('returns an error if the org does not have a license id', function (done) {
      var Customer = new CustomerModel('bob');
      var customerMock = nock(Customer.host)
        .get('/customer/bob/stripe/subscription')
        .reply(200, [
          {
            "id": "sub_abcd",
            "current_period_end": 1439766874,
            "current_period_start": 1437088474,
            "quantity": 2,
            "status": "active",
            "interval": "month",
            "amount": 600,
            "npm_org": "bigco",
            "npm_user": "rockbot",
            "product_id": "1031405a-70b7-4a3f-b557-8609d9e1428a"
          }
        ]);

      Customer.getLicenseIdForOrg('bigco', function (err, licenseId) {
        customerMock.done();
        expect(err).to.exist();
        expect(err.message).to.equal('That org does not have a license_id');
        expect(licenseId).to.not.exist();
        done();
      });
    });

    it('gets the license id for an org', function (done) {
      var Customer = new CustomerModel('bob');
      var customerMock = nock(Customer.host)
        .get('/customer/bob/stripe/subscription')
        .reply(200, fixtures.users.bobsubscriptions);

      Customer.getLicenseIdForOrg('bigco', function (err, licenseId) {
        customerMock.done();
        expect(err).to.be.null();
        expect(licenseId).to.equal(1);
        done();
      });
    });
  });

  describe("getAllSponsorships", function () {
    //TODO: handle error cases
    it('has error when string is passed for licenseId', function (done) {
      var Customer = new CustomerModel('bob');
      var customerMock = nock(Customer.host)
        .get('/sponsorship/asdbadbb')
        .reply(500, "invalid input syntax for integer: \"asdbadbb\"");

      Customer.getAllSponsorships('asdbadbb', function (err, sponsorships) {
        customerMock.done();
        expect(err).to.exist();
        expect(err.statusCode).to.equal(500);
        expect(err.message).to.equal("invalid input syntax for integer: \"asdbadbb\"");
        done();
      });
    });

    it('gets all sponsorships for an organization', function (done) {
      var Customer = new CustomerModel('bob');
      var customerMock = nock(Customer.host)
        .get('/sponsorship/123')
        .reply(200, [
          {
            "id": 10,
            "license_id": 123,
            "npm_user": "bob",
            "verification_key": "1031405a-70b7-4a3f-b553-8609d9e4428e",
            "verified": true,
            "created": "2015-07-28T18:42:00.623Z",
            "updated": "2015-07-28T18:42:00.715Z",
            "deleted": null
          }
        ]);

      Customer.getAllSponsorships(123, function (err, sponsorships) {
        customerMock.done();
        expect(err).to.be.null();
        expect(sponsorships).to.be.an.array();
        expect(sponsorships[0].license_id).to.equal(123);
        expect(sponsorships[0].npm_user).to.equal('bob');
        done();
      });
    });
  });

  describe("extendSponsorship", function () {
    it("throws an error if licenseId doesn't exist", function (done) {
      var Customer = new CustomerModel('bob');
      var customerMock = nock(Customer.host)
        .put('/sponsorship/11111', { npm_user: "boomer" })
        .reply(404);

      Customer.extendSponsorship(11111, "boomer", function (err, sponsorships) {
        customerMock.done();
        expect(err).to.exist();
        expect(err.message).to.equal("License not found: 11111");
        expect(err.statusCode).to.equal(404);

        done();
      });
    });

    it("creates a sponsorship for a user", function (done) {
      var Customer = new CustomerModel('bob');
      var customerMock = nock(Customer.host)
        .put('/sponsorship/123', { npm_user: "boomer" })
        .reply(200, [
          {
              "created": "2015-07-28T18:42:00.623Z",
              "deleted": null,
              "id": 10,
              "license_id": 20,
              "npm_user": "boomer",
              "updated": "2015-07-28T18:42:00.715Z",
              "verification_key": "e640f651-ef53-4560-86a6-34cae5a38e15",
              "verified": null
          }
        ]);

      Customer.extendSponsorship(123, "boomer", function (err, sponsorships) {
        customerMock.done();
        expect(err).to.be.null();
        expect(sponsorships).to.be.an.array();
        expect(sponsorships[0].license_id).to.equal(20);
        expect(sponsorships[0].npm_user).to.equal("boomer");
        done();
      });
    });
  });

  describe("acceptSponsorship", function () {
    it('returns an error if the verification key is invalid', function (done) {
      var verification_key = '4aboom';

      var Customer = new CustomerModel('bob');
      var customerMock = nock(Customer.host)
        .post('/sponsorship/' + verification_key)
        .reply(404);

      Customer.acceptSponsorship(verification_key, function (err, verifiedUser) {
        customerMock.done();
        expect(err).to.exist();
        expect(err.message).to.equal('verification key not found');
        expect(verifiedUser).to.not.exist();
        done();
      });
    });

    it('returns an error if the user is already sponsored', function (done) {
      var verification_key = 'e640f651-ef53-4560-86a6-34cae5a38e20';

      var Customer = new CustomerModel('bob');
      var customerMock = nock(Customer.host)
        .post('/sponsorship/' + verification_key)
        .reply(500, "duplicate key value violates unique constraint \"sponsorships_npm_user\"");

      Customer.acceptSponsorship(verification_key, function (err, verifiedUser) {
        customerMock.done();
        expect(err).to.exist();
        expect(err.message).to.equal('user is already sponsored');
        expect(err.statusCode).to.equal(403);
        expect(verifiedUser).to.not.exist();
        done();
      });
    });

    it('accepts a sponsorship with a valid verification key', function (done) {
      var verification_key = 'e640f651-ef53-4560-86a6-34cae5a38e15';

      var Customer = new CustomerModel('bob');
      var customerMock = nock(Customer.host)
        .post('/sponsorship/' + verification_key)
        .reply(200, {
          "id": 10,
          "license_id": 20,
          "npm_user": "boomer",
          "verification_key": verification_key,
          "verified": true,
          "created": "2015-07-29T14:13:04.826Z",
          "updated": "2015-07-29T14:13:16.206Z",
          "deleted": null
        });

      Customer.acceptSponsorship(verification_key, function (err, verifiedUser) {
        customerMock.done();
        expect(err).to.not.exist();
        expect(verifiedUser.verification_key).to.equal(verification_key);
        expect(verifiedUser.verified).to.be.true();
        done();
      });
    });
  });

  describe('removeSponsorship', function () {
    it('returns an error if the user is not found', function (done) {
      var Customer = new CustomerModel('bob');
      var customerMock = nock(Customer.host)
        .delete('/sponsorship/20/notfound')
        .reply(404);

      Customer.removeSponsorship("notfound", 20, function (err, removedUser) {
        customerMock.done();
        expect(err).to.exist();
        expect(err.message).to.equal('user or licenseId not found');
        expect(removedUser).to.not.exist();
        done();
      });
    });

    it('removes the sponsorship for a valid user', function (done) {
      var Customer = new CustomerModel('bob');
      var customerMock = nock(Customer.host)
        .delete('/sponsorship/20/boomer')
        .reply(200, {
          "id": 10,
          "license_id": 20,
          "npm_user": "boomer",
          "verification_key": "e640f651-ef53-4560-86a6-34cae5a38e15",
          "verified": true,
          "created": "2015-07-29T14:13:04.826Z",
          "updated": "2015-07-29T14:13:16.206Z",
          "deleted": "2015-07-29T14:53:01.243Z"
        });

      Customer.removeSponsorship("boomer", 20, function (err, removedUser) {
        customerMock.done();
        expect(err).to.not.exist();
        expect(removedUser.npm_user).to.equal('boomer');
        expect(removedUser.deleted).to.be.a.string();
        done();
      });
    });

    it('is an alias for declineSponsorship', function (done) {
      var Customer = new CustomerModel('bob');
      var customerMock = nock(Customer.host)
        .delete('/sponsorship/20/boomer')
        .reply(200, {
          "id": 10,
          "license_id": 20,
          "npm_user": "boomer",
          "verification_key": "e640f651-ef53-4560-86a6-34cae5a38e15",
          "verified": true,
          "created": "2015-07-29T14:13:04.826Z",
          "updated": "2015-07-29T14:13:16.206Z",
          "deleted": "2015-07-29T14:53:01.243Z"
        });

      Customer.declineSponsorship("boomer", 20, function (err, removedUser) {
        customerMock.done();
        expect(err).to.not.exist();
        expect(removedUser.npm_user).to.equal('boomer');
        expect(removedUser.deleted).to.be.a.string();
        done();
      });
    });

    it('is an alias for revokeSponsorship', function (done) {
      var Customer = new CustomerModel('bob');
      var customerMock = nock(Customer.host)
        .delete('/sponsorship/20/boomer')
        .reply(200, {
          "id": 10,
          "license_id": 20,
          "npm_user": "boomer",
          "verification_key": "e640f651-ef53-4560-86a6-34cae5a38e15",
          "verified": true,
          "created": "2015-07-29T14:13:04.826Z",
          "updated": "2015-07-29T14:13:16.206Z",
          "deleted": "2015-07-29T14:53:01.243Z"
        });

      Customer.revokeSponsorship("boomer", 20, function (err, removedUser) {
        customerMock.done();
        expect(err).to.not.exist();
        expect(removedUser.npm_user).to.equal('boomer');
        expect(removedUser.deleted).to.be.a.string();
        done();
      });
    });
  });
});
