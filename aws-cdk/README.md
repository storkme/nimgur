### Pre-reqs

You need the AWS CLI set up for this.

You need to set up some stuff manually before this will work. You'll need a domain that you own (for the CDN) and a certificate set up for that domain. Set the following env vars:
* `CDN_HOST` → the domain name you want to host it on
* `ARN_CERTIFICATE` → the ARN of the certificate for the above domains

And install the NPM packages:
```shell
$ npm install
```

### Deploy

The following command will set up this stack and put it in AWS.

```shell
$ npm run cdk deploy
```
