serverless create \
    --template aws-python3 \
    --name adapter-dgt

serverless invoke local --function hello

serverless deploy