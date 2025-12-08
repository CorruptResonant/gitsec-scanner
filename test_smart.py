# This is a comment: password = "secret" (Should be IGNORED)
# print("eval(bad)") (Should be IGNORED)

def main():
    real_password = "super_secret_123"  # Should be CAUGHT

    x = input("Enter something: ")      # Should be CAUGHT

    eval("print(x)")                    # Should be CAUGHT

    try:
        print("working")
    except:
        pass                            # Should be CAUGHT

if __name__ == "__main__":
    main()