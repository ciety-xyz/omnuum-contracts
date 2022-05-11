const AWS = require('aws-sdk');
const chalk = require('chalk');

const s3Upload = async ({ bucketName, keyName, fileBuffer, region = 'ap-northeast-2' }) => {
  const s3 = new AWS.S3({ region });
  await s3
    .putObject({
      Bucket: bucketName,
      Key: keyName,
      Body: fileBuffer,
    })
    .promise();
  console.log(`Successfully uploaded data to\n${chalk.yellow(`https://s3.console.aws.amazon.com/s3/object/${bucketName}/${keyName}`)}`);
};

module.exports = { s3Upload };
