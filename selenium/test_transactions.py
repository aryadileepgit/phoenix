from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class TestTransactions:

    def setup_method(self):
        self.driver = webdriver.Chrome()
        self.wait = WebDriverWait(self.driver, 20)

    def teardown_method(self):
        self.driver.quit()

    def test_transactions(self):

        self.driver.get("http://localhost:5173/transactions")

        rows = self.wait.until(
            EC.presence_of_all_elements_located(
                (By.CSS_SELECTOR, ".cursor-pointer")
            )
        )

        print("Rows:", len(rows))

        rows[0].click()

        self.driver.save_screenshot("after_row_click.png")

        buttons = self.driver.find_elements(By.CSS_SELECTOR, ".bg-success")
        print("Success buttons:", len(buttons))

        inputs = self.driver.find_elements(
            By.CSS_SELECTOR,
            ".min-w-\\[220px\\]"
        )
        print("Inputs:", len(inputs))