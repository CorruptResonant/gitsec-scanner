import ast

class SecurityVisitor(ast.NodeVisitor):
    def __init__(self, filename, code_lines):
        self.issues = []
        self.filename = filename
        self.code_lines = code_lines # Store all lines of code

    def add_issue(self, node, issue_text, severity):
        """Helper to add an issue with line number and code snippet."""
        line_num = node.lineno
        
        # Capture the specific line of code (clean up whitespace)
        # Python lists are 0-indexed, line numbers are 1-indexed
        try:
            code_snippet = self.code_lines[line_num - 1].strip()
        except IndexError:
            code_snippet = "(Code not available)"

        self.issues.append({
            "filename": self.filename,
            "line": line_num,
            "issue": issue_text,
            "severity": severity,
            "code": code_snippet  # <--- NEW: Sending the actual code!
        })

    def visit_Assign(self, node):
        """
        Check for Hardcoded Secrets.
        Looks for variables like 'api_key', 'password' assigned to string literals.
        """
        for target in node.targets:
            if isinstance(target, ast.Name):
                var_name = target.id.lower()
                # Check if variable name looks suspicious
                if any(secret in var_name for secret in ['key', 'password', 'secret', 'token']):
                    # Check if the value assigned is a string (Constant)
                    if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                        self.add_issue(node, f"Possible Hardcoded Secret: '{target.id}'", "High")
        
        # Continue visiting child nodes
        self.generic_visit(node)

    def visit_Call(self, node):
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
            
            if func_name in ['eval', 'exec']:
                self.add_issue(node, f"Use of Dangerous Function ({func_name})", "High")
            
            elif func_name == 'input':
                self.add_issue(node, "Use of input() (Validate this data!)", "Medium")
                
        # --- NEW CHECK: Detect os.system and subprocess ---
        elif isinstance(node.func, ast.Attribute):
            # Checks for os.system(), subprocess.run(), etc.
            if isinstance(node.func.value, ast.Name):
                module = node.func.value.id
                method = node.func.attr
                if module == 'os' and method in ['system', 'popen']:
                    self.add_issue(node, f"Potential OS Command Injection: {module}.{method}", "High")
                elif module == 'subprocess' and method in ['run', 'call', 'Popen']:
                    self.add_issue(node, f"Potential Subprocess Injection: {module}.{method}", "High")

        self.generic_visit(node)

    def visit_ExceptHandler(self, node):
        """
        Check for Empty Except Blocks (pass/continue only).
        """
        # If the body has only one statement
        if len(node.body) == 1:
            statement = node.body[0]
            # Check if that statement is 'pass' or '...' (Ellipsis)
            if isinstance(statement, ast.Pass) or (isinstance(statement, ast.Expr) and isinstance(statement.value, ast.Constant) and statement.value.value is Ellipsis):
                self.add_issue(node, "Broad Exception Handler (empty except)", "Low")
        
        self.generic_visit(node)


def scan_code(code: str, filename: str) -> list:
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return [{
            "filename": filename,
            "line": e.lineno or 0,
            "issue": f"Syntax Error: {e.msg}",
            "severity": "Error",
            "code": "N/A"
        }]
    except Exception as e:
        return [{
            "filename": filename,
            "line": 0,
            "issue": f"Failed to parse: {str(e)}",
            "severity": "Error",
            "code": "N/A"
        }]

    # Split code into lines so we can grab snippets
    code_lines = code.splitlines()
    
    # Pass lines to visitor
    visitor = SecurityVisitor(filename, code_lines)
    visitor.visit(tree)
    
    return visitor.issues