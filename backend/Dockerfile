FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-fetch the JPL planetary ephemeris (~17 MB) so the first boot
# doesn't depend on an external download.
RUN python -c "from skyfield.api import load; load('de421.bsp')"

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
