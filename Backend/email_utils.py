import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USERNAME)


def send_email(to_email: str, subject: str, body: str) -> None:
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        raise RuntimeError("SMTP_USERNAME/SMTP_PASSWORD are not configured in the environment")

    message = MIMEMultipart()
    message["From"] = SMTP_FROM
    message["To"] = to_email
    message["Subject"] = subject
    message.attach(MIMEText(body, "plain"))

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, to_email, message.as_string())


def send_otp_email(to_email: str, otp_code: str) -> None:
    subject = "Your Survey Dashboard password reset code"
    body = (
        f"Your one-time password (OTP) is: {otp_code}\n\n"
        "This code expires in 10 minutes. If you did not request a password reset, "
        "you can safely ignore this email."
    )
    send_email(to_email, subject, body)
