#!/bin/bash

# Set your GCP project ID
PROJECT_ID="lazy-job-seeker-4b29b"

# Configure project
gcloud config set project $PROJECT_ID

# Build the Docker image
docker build --platform linux/amd64 -t gcr.io/$PROJECT_ID/pdf-converter .

# Push the Docker image to Google Container Registry
docker push gcr.io/$PROJECT_ID/pdf-converter

# Deploy to Cloud Run with increased timeout
gcloud run deploy pdf-converter \
  --image gcr.io/$PROJECT_ID/pdf-converter \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --cpu=1 \
  --memory=2Gi \
  --min-instances=0 \
  --set-env-vars="NODE_ENV=production,PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true,PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium" \
  --timeout=5m

echo "Deployment complete. Your app should be available at:"
echo "https://pdf-converter-$PROJECT_ID.run.app"