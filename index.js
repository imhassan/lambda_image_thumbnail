// dependencies
var AWS = require('aws-sdk');

var gm = require('gm').subClass({
	imageMagick : true
});

var s3 = new AWS.S3();

var MAX_WIDTH_T = 250, MAX_HEIGHT_T = 150;

exports.handler = function(event, context) {
	// Read options from the event.
	var srcBucket = event.Records[0].s3.bucket.name;
	var srcKey = event.Records[0].s3.object.key;
	var dstBucket = 'output-' + srcBucket;// + "-thumbnails"
	var srcFilenameArr = srcKey.split(".");
	var srcFileKey = srcFilenameArr[0];
	var srcFileExt = srcFilenameArr[1].toLowerCase();

	// standard file should look like:
	// "/something/something/something/upload/{fileid}.{ext}"
	var dstKeyT = srcFileKey + '_t.' + srcFileExt;
	// Sanity check: validate that source and destination are different buckets.

	var validImageTypes = [ 'png', 'jpg', 'jpeg', 'gif' ];
	if (validImageTypes.indexOf(srcFileExt) < 0) {
		context.done(null, {
			status : false,
			message : 'Image extension does not match.'
		});
	}

	// Download the image from S3, transform, and upload to a different S3
	// bucket.
	s3.getObject({
		Bucket : srcBucket,
		Key : srcKey
	}, function(err, data) {
		if (err) {
			console.log(err);
			context.done(null, {
				status : false,
				message : 'Unable to download the image.'
			});
		} else {
			gm(data.Body).size(function(err, size) {
				// Infer the scaling factor to avoid stretching the image
				// unnaturally.
				var scalingFactor = Math.min(MAX_WIDTH_T / size.width, MAX_HEIGHT_T / size.height);
				var width = scalingFactor * size.width;
				var height = scalingFactor * size.height;

				// Transform the image buffer in memory.
				this.resize(width, height).toBuffer(srcFileExt, function(err, buffer) {
					if (err) {
						console.log(err);
						context.done(null, {
							status : false,
							message : 'Unable to create thumnail image.'
						});

					} else {
						s3.putObject({
							Bucket : dstBucket,
							Key : dstKeyT,
							Body : buffer,
							ContentType : data.ContentType
						}, function(err, data) {

							if (err) {
								console.log(err);
								context.done(null, {
									status : false,
									message : 'Unable to upload the image.'
								});
							} else {
								context.done(null, {
									status : true,
									message : 'Thumnail image uploaded successfully.'
								});
							}

						});
					}
				});
			});
		}
	});

};

// lambda-local -l index.js -h handler -e data/input.js -t 60
