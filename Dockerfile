
FROM python:3.12-alpine

WORKDIR /app

# Copy the application files
COPY . .

# Render provides PORT.
# Use 10000 for local Docker testing.
ENV PORT=10000

EXPOSE 10000

# Start a static HTTP server
CMD ["sh", "-c", "python -m http.server ${PORT:-10000} --bind 0.0.0.0 --directory /app"]
