var generateCrumb = require("../handlers/crumb.js"),
    Lab = require('lab'),
    Code = require('code'),
    nock = require('nock'),
    lab = exports.lab = Lab.script(),
    describe = lab.experiment,
    before = lab.before,
    after = lab.after,
    it = lab.test,
    expect = Code.expect,
    server,
    fixtures = require('../fixtures');

before(function (done) {
  process.env.FEATURE_ORG_BILLING = 'true';
  require('../mocks/server')(function (obj) {
    server = obj;
    done();
  });
});

after(function (done) {
  delete process.env.FEATURE_ORG_BILLING;
  server.stop(done);
});

describe('getting an org', function () {
  it('does not include sponsorships if the org has not sponsored anyone', function (done) {
    var userMock = nock("https://user-api-example.com")
      .get("/user/bob")
      .reply(200, fixtures.users.bob);

    var licenseMock = nock("https://license-api-example.com:443")
      .get("/customer/bob/stripe")
      .reply(200, fixtures.customers.happy)
      .get("/customer/bob/stripe/subscription")
      .reply(200, fixtures.users.bobsubscriptions)
      .get("/sponsorship/1")
      .reply(404);

    var orgMock = nock("https://user-api-example.com")
      .get('/org/bigco')
      .reply(200, fixtures.orgs.bigco)
      .get('/org/bigco/user')
      .reply(200, fixtures.orgs.bigcoUsers);

    var options = {
      url: "/org/bigco",
      credentials: fixtures.users.bob
    };

    server.inject(options, function (resp) {
      userMock.done();
      licenseMock.done();
      orgMock.done();
      expect(resp.statusCode).to.equal(200);
      expect(resp.request.response.source.template).to.equal('org/info');
      expect(resp.request.response.source.context).to.not.include('sponsorships');
      done();
    });
  });

  it('includes sponsorships if the org has sponsored someone', function (done) {
    var userMock = nock("https://user-api-example.com")
      .get("/user/bob")
      .reply(200, fixtures.users.bob);

    var licenseMock = nock("https://license-api-example.com")
      .get("/customer/bob/stripe")
      .reply(200, fixtures.customers.happy)
      .get("/customer/bob/stripe/subscription")
      .reply(200, fixtures.users.bobsubscriptions)
      .get("/sponsorship/1")
      .reply(200, fixtures.orgs.bigcoSponsorships);

    var orgMock = nock("https://user-api-example.com")
      .get('/org/bigco')
      .reply(200, fixtures.orgs.bigco)
      .get('/org/bigco/user')
      .reply(200, fixtures.orgs.bigcoUsers);

    var options = {
      url: "/org/bigco",
      credentials: fixtures.users.bob
    };

    server.inject(options, function (resp) {
      userMock.done();
      licenseMock.done();
      orgMock.done();
      expect(resp.statusCode).to.equal(200);
      expect(resp.request.response.source.template).to.equal('org/info');
      expect(resp.request.response.source.context).to.include('sponsorships');
      done();
    });
  });

  it('does not include sponsorships if the org does not exist', function (done) {
    var userMock = nock("https://user-api-example.com")
      .get("/user/bob")
      .reply(200, fixtures.users.bob);

    var licenseMock = nock("https://license-api-example.com")
      .get("/customer/bob/stripe")
      .reply(200, fixtures.customers.happy)
      .get("/customer/bob/stripe/subscription")
      .reply(200, fixtures.users.bobPrivateModules);

    var orgMock = nock("https://user-api-example.com")
      .get('/org/bigco')
      .reply(404)
      .get('/org/bigco/user')
      .reply(404);

    var options = {
      url: "/org/bigco",
      credentials: fixtures.users.bob
    };

    server.inject(options, function (resp) {
      userMock.done();
      licenseMock.done();
      orgMock.done();
      expect(resp.statusCode).to.equal(200);
      expect(resp.request.response.source.template).to.equal('org/info');
      expect(resp.request.response.source.context).to.not.include('sponsorships');
      done();
    });
  });
});

describe('updating an org', function () {
  describe('adding a user', function () {
    it('renders an error if a user cannot be added to an org', function (done) {
      generateCrumb(server, function (crumb) {
        var userMock = nock("https://user-api-example.com")
          .get("/user/bob")
          .reply(200, fixtures.users.bob);

        var licenseMock = nock("https://license-api-example.com")
          .get("/customer/bob/stripe")
          .reply(200, fixtures.customers.happy);

        var orgMock = nock("https://user-api-example.com")
          .put('/org/bigco/user', {
            user: 'betty',
            role: 'developer'
          })
          .reply(401);

        var options = {
          url: "/org/bigco",
          method: "post",
          credentials: fixtures.users.bob,
          payload: {
            username: 'betty',
            role: 'developer',
            updateType: 'addUser',
            crumb: crumb
          },
          headers: {
            cookie: 'crumb=' + crumb
          }
        };

        server.inject(options, function (resp) {
          userMock.done();
          licenseMock.done();
          orgMock.done();
          expect(resp.statusCode).to.equal(401);
          expect(resp.request.response.source.template).to.equal('errors/internal');
          done();
        });
      });
    });

    it('renders an error if the license of the org cannot be retrieved', function (done) {
      generateCrumb(server, function (crumb) {
        var userMock = nock("https://user-api-example.com")
          .get("/user/bob")
          .reply(200, fixtures.users.bob);

        var licenseMock = nock("https://license-api-example.com")
          .get("/customer/bob/stripe")
          .reply(200, fixtures.customers.happy)
          .get("/customer/bob/stripe/subscription")
          .reply(200, []);

        var orgMock = nock("https://user-api-example.com")
          .put('/org/bigco/user', {
            user: 'betty',
            role: 'developer'
          })
          .reply(200, {
            "created": "2015-08-05T15:26:46.970Z",
            "deleted": null,
            "org_id": 1,
            "role": "developer",
            "updated": "2015-08-05T15:26:46.970Z",
            "user_id": 15
          });

        var options = {
          url: "/org/bigco",
          method: "post",
          credentials: fixtures.users.bob,
          payload: {
            username: 'betty',
            role: 'developer',
            updateType: 'addUser',
            crumb: crumb
          },
          headers: {
            cookie: 'crumb=' + crumb
          }
        };

        server.inject(options, function (resp) {
          userMock.done();
          licenseMock.done();
          orgMock.done();
          expect(resp.statusCode).to.equal(404);
          expect(resp.request.response.source.template).to.equal('errors/internal');
          done();
        });
      });
    });

    it('renders an eror if a sponsorship cannot be extended', function (done) {
      generateCrumb(server, function (crumb) {
        var userMock = nock("https://user-api-example.com")
          .get("/user/bob")
          .reply(200, fixtures.users.bob);

        var licenseMock = nock("https://license-api-example.com")
          .get("/customer/bob/stripe")
          .reply(200, fixtures.customers.happy)
          .get("/customer/bob/stripe/subscription")
          .reply(200, fixtures.users.bobsubscriptions)
          .put("/sponsorship/1", {"npm_user":"betty"})
          .reply(404);

        var orgMock = nock("https://user-api-example.com")
          .put('/org/bigco/user', {
            user: 'betty',
            role: 'developer'
          })
          .reply(200, {
            "created": "2015-08-05T15:26:46.970Z",
            "deleted": null,
            "org_id": 1,
            "role": "developer",
            "updated": "2015-08-05T15:26:46.970Z",
            "user_id": 15
          });

        var options = {
          url: "/org/bigco",
          method: "post",
          credentials: fixtures.users.bob,
          payload: {
            username: 'betty',
            role: 'developer',
            updateType: 'addUser',
            crumb: crumb
          },
          headers: {
            cookie: 'crumb=' + crumb
          }
        };

        server.inject(options, function (resp) {
          userMock.done();
          licenseMock.done();
          orgMock.done();
          expect(resp.statusCode).to.equal(404);
          expect(resp.request.response.source.template).to.equal('errors/internal');
          done();
        });
      });
    });

    it('renders an error if a sponsorship cannot be accepted', function (done) {
      generateCrumb(server, function (crumb) {
        var userMock = nock("https://user-api-example.com")
          .get("/user/bob")
          .reply(200, fixtures.users.bob);

        var licenseMock = nock("https://license-api-example.com")
          .get("/customer/bob/stripe")
          .reply(200, fixtures.customers.happy)
          .get("/customer/bob/stripe/subscription")
          .reply(200, fixtures.users.bobsubscriptions)
          .put("/sponsorship/1", {"npm_user":"betty"})
          .reply(200, {
            "created": "2015-08-05T20:55:54.759Z",
            "deleted": null,
            "id": 15,
            "license_id": 1,
            "npm_user": "betty",
            "updated": "2015-08-05T20:55:54.759Z",
            "verification_key": "f56dffef-b136-429a-97dc-57a6ef035829",
            "verified": null
          })
          .post("/sponsorship/f56dffef-b136-429a-97dc-57a6ef035829")
          .reply(404);

        var orgMock = nock("https://user-api-example.com")
          .put('/org/bigco/user', {
            user: 'betty',
            role: 'developer'
          })
          .reply(200, {
            "created": "2015-08-05T15:26:46.970Z",
            "deleted": null,
            "org_id": 1,
            "role": "developer",
            "updated": "2015-08-05T15:26:46.970Z",
            "user_id": 15
          });

        var options = {
          url: "/org/bigco",
          method: "post",
          credentials: fixtures.users.bob,
          payload: {
            username: 'betty',
            role: 'developer',
            updateType: 'addUser',
            crumb: crumb
          },
          headers: {
            cookie: 'crumb=' + crumb
          }
        };

        server.inject(options, function (resp) {
          userMock.done();
          licenseMock.done();
          orgMock.done();
          expect(resp.statusCode).to.equal(404);
          expect(resp.request.response.source.template).to.equal('errors/internal');
          done();
        });
      });
    });

    it('successfully adds the user to the org', function (done) {
      generateCrumb(server, function (crumb) {
        var userMock = nock("https://user-api-example.com")
          .get("/user/bob")
          .reply(200, fixtures.users.bob);

        var licenseMock = nock("https://license-api-example.com")
          .get("/customer/bob/stripe")
          .reply(200, fixtures.customers.happy)
          .get("/customer/bob/stripe/subscription")
          .reply(200, fixtures.users.bobsubscriptions)
          .put("/sponsorship/1", {"npm_user":"betty"})
          .reply(200, {
            "created": "2015-08-05T20:55:54.759Z",
            "deleted": null,
            "id": 15,
            "license_id": 1,
            "npm_user": "betty",
            "updated": "2015-08-05T20:55:54.759Z",
            "verification_key": "f56dffef-b136-429a-97dc-57a6ef035829",
            "verified": null
          })
          .post("/sponsorship/f56dffef-b136-429a-97dc-57a6ef035829")
          .reply(200, {
            "created": "2015-08-05T20:59:32.707Z",
            "deleted": null,
            "id": 15,
            "license_id": 1,
            "npm_user": "betty",
            "updated": "2015-08-05T20:59:41.538Z",
            "verification_key": "f56dffef-b136-429a-97dc-57a6ef035829",
            "verified": true
          });

        var orgMock = nock("https://user-api-example.com")
          .put('/org/bigco/user', {
            user: 'betty',
            role: 'developer'
          })
          .reply(200, {
            "created": "2015-08-05T15:26:46.970Z",
            "deleted": null,
            "org_id": 1,
            "role": "developer",
            "updated": "2015-08-05T15:26:46.970Z",
            "user_id": 15
          })
          .get("/org/bigco")
          .reply(200, fixtures.orgs.bigco)
          .get("/org/bigco/user")
          .reply(200, fixtures.orgs.bigcoAddedUsers);

        var options = {
          url: "/org/bigco",
          method: "post",
          credentials: fixtures.users.bob,
          payload: {
            username: 'betty',
            role: 'developer',
            updateType: 'addUser',
            crumb: crumb
          },
          headers: {
            cookie: 'crumb=' + crumb
          }
        };

        server.inject(options, function (resp) {
          userMock.done();
          licenseMock.done();
          orgMock.done();
          expect(resp.statusCode).to.equal(200);
          expect(resp.request.response.source.template).to.equal('org/info');
          done();
        });
      });
    });
  });

  describe('removing a user', function () {
    it('renders an error if the org license cannot be retrieved', function (done) {
      generateCrumb(server, function (crumb) {
        var userMock = nock("https://user-api-example.com")
          .get("/user/bob")
          .reply(200, fixtures.users.bob);

        var licenseMock = nock("https://license-api-example.com")
          .get("/customer/bob/stripe")
          .reply(200, fixtures.customers.happy)
          .get("/customer/bob/stripe/subscription")
          .reply(404);

        var options = {
          url: "/org/bigco",
          method: "post",
          credentials: fixtures.users.bob,
          payload: {
            username: 'betty',
            role: 'developer',
            updateType: 'deleteUser',
            crumb: crumb
          },
          headers: {
            cookie: 'crumb=' + crumb
          }
        };

        server.inject(options, function (resp) {
          userMock.done();
          licenseMock.done();
          expect(resp.statusCode).to.equal(404);
          expect(resp.request.response.source.template).to.equal('errors/internal');
          done();
        });
      });
    });

    it('renders an error if the sponsorship cannot be revoked', function (done) {
      generateCrumb(server, function (crumb) {
        var userMock = nock("https://user-api-example.com")
          .get("/user/bob")
          .reply(200, fixtures.users.bob);

        var licenseMock = nock("https://license-api-example.com")
          .get("/customer/bob/stripe")
          .reply(200, fixtures.customers.happy)
          .get("/customer/bob/stripe/subscription")
          .reply(200, fixtures.users.bobsubscriptions)
          .delete("/sponsorship/1/betty")
          .reply(404);

        var options = {
          url: "/org/bigco",
          method: "post",
          credentials: fixtures.users.bob,
          payload: {
            username: 'betty',
            role: 'developer',
            updateType: 'deleteUser',
            crumb: crumb
          },
          headers: {
            cookie: 'crumb=' + crumb
          }
        };

        server.inject(options, function (resp) {
          userMock.done();
          licenseMock.done();
          expect(resp.statusCode).to.equal(404);
          expect(resp.request.response.source.template).to.equal('errors/internal');
          done();
        });
      });
    });

    it('renders an error if the org is unable to remove the user', function (done) {
      generateCrumb(server, function (crumb) {
        var userMock = nock("https://user-api-example.com")
          .get("/user/bob")
          .reply(200, fixtures.users.bob);

        var licenseMock = nock("https://license-api-example.com")
          .get("/customer/bob/stripe")
          .reply(200, fixtures.customers.happy)
          .get("/customer/bob/stripe/subscription")
          .reply(200, fixtures.users.bobsubscriptions)
          .delete("/sponsorship/1/betty")
          .reply(200, {
            "created": "2015-08-05T20:55:54.759Z",
            "deleted": "2015-08-05T15:30:46.970Z",
            "id": 15,
            "license_id": 1,
            "npm_user": "betty",
            "updated": "2015-08-05T20:55:54.759Z",
            "verification_key": "f56dffef-b136-429a-97dc-57a6ef035829",
            "verified": null
          });

        var orgMock = nock("https://user-api-example.com")
          .delete('/org/bigco/user/betty')
          .reply(404);

        var options = {
          url: "/org/bigco",
          method: "post",
          credentials: fixtures.users.bob,
          payload: {
            username: 'betty',
            role: 'developer',
            updateType: 'deleteUser',
            crumb: crumb
          },
          headers: {
            cookie: 'crumb=' + crumb
          }
        };

        server.inject(options, function (resp) {
          userMock.done();
          licenseMock.done();
          orgMock.done();
          expect(resp.statusCode).to.equal(404);
          expect(resp.request.response.source.template).to.equal('errors/internal');
          done();
        });
      });
    });

    it('successfully deletes the user from the organization', function (done) {
      generateCrumb(server, function (crumb) {
        var userMock = nock("https://user-api-example.com")
          .get("/user/bob")
          .reply(200, fixtures.users.bob);

        var licenseMock = nock("https://license-api-example.com")
          .get("/customer/bob/stripe")
          .reply(200, fixtures.customers.happy)
          .get("/customer/bob/stripe/subscription")
          .reply(200, fixtures.users.bobsubscriptions)
          .delete("/sponsorship/1/betty")
          .reply(200, {
            "created": "2015-08-05T20:55:54.759Z",
            "deleted": "2015-08-05T15:30:46.970Z",
            "id": 15,
            "license_id": 1,
            "npm_user": "betty",
            "updated": "2015-08-05T20:55:54.759Z",
            "verification_key": "f56dffef-b136-429a-97dc-57a6ef035829",
            "verified": null
          });

        var orgMock = nock("https://user-api-example.com")
          .delete('/org/bigco/user/betty')
          .reply(200, {
            "created": "2015-08-05T15:26:46.970Z",
            "deleted": "2015-08-05T15:30:46.970Z",
            "org_id": 1,
            "role": "developer",
            "updated": "2015-08-05T15:26:46.970Z",
            "user_id": 15
          })
          .get("/org/bigco")
          .reply(200, fixtures.orgs.bigco)
          .get("/org/bigco/user")
          .reply(200, fixtures.orgs.bigcoAddedUsers);

        var options = {
          url: "/org/bigco",
          method: "post",
          credentials: fixtures.users.bob,
          payload: {
            username: 'betty',
            role: 'developer',
            updateType: 'deleteUser',
            crumb: crumb
          },
          headers: {
            cookie: 'crumb=' + crumb
          }
        };

        server.inject(options, function (resp) {
          userMock.done();
          licenseMock.done();
          orgMock.done();
          expect(resp.statusCode).to.equal(200);
          expect(resp.request.response.source.template).to.equal('org/info');
          done();
        });
      });
    });
  });
});

describe('deleting an org', function () {
  it('deletes the org if it exists', function (done) {
    var userMock = nock("https://user-api-example.com")
      .get("/user/bob")
      .reply(200, fixtures.users.bob);

    var licenseMock = nock("https://license-api-example.com")
      .get("/customer/bob/stripe")
      .reply(200, fixtures.customers.happy);

    var orgMock = nock("https://user-api-example.com")
      .delete('/org/bigco')
      .reply(200, fixtures.orgs.bigcoDeleted);

    var options = {
      url: "/org/bigco",
      method: "DELETE",
      credentials: fixtures.users.bob
    };

    server.inject(options, function (resp) {
      userMock.done();
      licenseMock.done();
      orgMock.done();
      expect(resp.statusCode).to.equal(302);
      expect(resp.headers.location).to.include('/org');
      done();
    });
  });
});