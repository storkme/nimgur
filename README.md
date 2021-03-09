# storkme/nimgur

an image hosting service.

this service uses|for
----:|--------------
aws s3|hosting image files
aws dynamodb|storing image metadata
aws cloudfront|caching and http stuff
aws ecr|storing prod docker images|
aws cdk|for managing the above infrastructure
github actions|for building and deploying the REST API to my personal server 

note that this service by default captures all kinds of personal data (GDPR) so if it's being used for anything other than personal use make sure you get that consent.

### TODO: architecture diagram here ###

## required steps for github actions

set up the two env vars: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

Generate the access keys by running: 
```shell
aws iam create-access-key --user-name "nimgur-api-ecr-rw" \
  | jq -r '.AccessKey | "AWS_ACCESS_KEY_ID=\(.AccessKeyId)\nAWS_SECRET_ACCESS_KEY=\(.SecretAccessKey)"'

```

And add the two secrets here https://github.com/USERNAME/REPO/settings/secrets/actions



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
