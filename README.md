# storkme/nimgur

Really simple AWS stack using lambdas, a CDN, and S3 to let you upload images and provide a link. Like a command-line imgur, without the website.

## How to use it?

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

### Hit it

Use this bash function (this relies on you having `jq` installed):
```shell
nimgur() { curl -s "https://$CDN_HOST/up" -H "Content-type: $(file -b --mime-type $1)" --data-binary "@$1" | jq -r '.href' }
```

Then, running it on a cool image will result in something like:

```shell
$ nimgur file.png
http://$CDN_HOST/cDiv1L.png
```
