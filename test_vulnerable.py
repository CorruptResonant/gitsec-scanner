import os

# 1. Secret Check
api_key = "12345-secret"

# 2. Eval Check
eval("print('hacked')")

# 3. Input Check
user_input = input("Enter name: ")

# 4. SQL Check
query = "SELECT * FROM users WHERE name = " + user_input

# 5. Empty Except Check
try:
    pass
except:
    pass