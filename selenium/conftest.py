"""
Pytest configuration for Phoenix Selenium tests.
"""
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager


@pytest.fixture(scope="session")
def base_url():
    """Base URL for the frontend application."""
    return "http://localhost:5173"


@pytest.fixture(scope="session")
def api_base_url():
    """Base URL for the backend API."""
    return "http://127.0.0.1:1992"


@pytest.fixture(scope="function")
def driver():
    """Create a Chrome WebDriver instance for each test."""
    options = ChromeOptions()
    # options.add_argument("--headless")  # Uncomment for CI
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,720")
    
    driver = webdriver.Chrome(
        service=ChromeService(ChromeDriverManager().install()),
        options=options
    )
    driver.implicitly_wait(5)
    yield driver
    driver.quit()


@pytest.fixture(scope="function")
def logged_in_driver(driver, base_url):
    """Create a driver that's already logged in."""
    driver.get(f"{base_url}/login")
    
    # Wait for login form
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.common.by import By
    
    wait = WebDriverWait(driver, 10)
    wait.until(EC.presence_of_element_located((By.ID, "email")))
    
    # Fill login form
    driver.find_element(By.ID, "email").send_keys("ayoradileep@gmail.com")
    driver.find_element(By.ID, "password").send_keys("dCrFOlcxBRlMIw3S")
    driver.find_element(By.ID, "password").send_keys("\n")
    
    # Wait for redirect to dashboard
    wait.until(EC.url_contains("/dashboard"))
    
    return driver


@pytest.fixture
def wait(driver):
    """WebDriverWait with 10 second timeout."""
    from selenium.webdriver.support.ui import WebDriverWait
    return WebDriverWait(driver, 10)


@pytest.fixture
def api_client(api_base_url):
    """API client for making direct API calls."""
    import requests
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line("markers", "ui: mark test as UI test")
    config.addinivalue_line("markers", "api: mark test as API test")
    config.addinivalue_line("markers", "slow: mark test as slow")


def pytest_html_report_title(report):
    """Custom HTML report title."""
    report.title = "Phoenix Selenium Test Report"