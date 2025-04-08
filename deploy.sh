#!/bin/bash

# Set your GCP project ID
PROJECT_ID="lazy-job-seeker-4b29b"

# Configure project
gcloud config set project $PROJECT_ID

# Check if App Engine application exists, if not create it
if ! gcloud app describe &>/dev/null; then
  echo "Creating App Engine application in region us-central..."
  gcloud app create --region=us-central
fi

# Deploy to App Engine
gcloud app deploy app.yaml --quiet

echo "Deployment complete. Your app should be available at:"
echo "https://$PROJECT_ID.appspot.com"