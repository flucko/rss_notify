FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Ensure data directory exists
RUN mkdir -p /app/data

EXPOSE 8000

# Run FastAPI app with Uvicorn
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
