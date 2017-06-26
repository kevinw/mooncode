'use strict';

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

let diagnosticCollection: vscode.DiagnosticCollection;

function rangeForLineNumber(lineNumber: number, textDocument: vscode.TextDocument) {
    var range = new vscode.Range(lineNumber, 0, lineNumber, 300);
    var text = textDocument.getText(range);
    let m = text.match(/^\s+/);
    if (!m)
        return range;

    let numSpaces = m[0].length;
    return new vscode.Range(lineNumber, numSpaces, lineNumber, 300);
}

function doLint(textDocument: vscode.TextDocument) {
    if (textDocument.languageId != "moonscript")
        return;

    let diagnostics: vscode.Diagnostic[] = [];
    let options = vscode.workspace.rootPath ? { cwd: vscode.workspace.rootPath } : undefined;
    let linter = process.env["APPDATA"] + "\\LuaRocks\\bin\\moonpick.bat";
    let childProcess = cp.spawn(linter, [textDocument.fileName], options);
    if (childProcess.pid) {
        let decoded = '';
        childProcess.stdout.on('data', (data: Buffer) => { decoded += data; });
        childProcess.stdout.on('end', () => {
            let parsed = true;
            {
                let failedToParse =/Failed to parse:\s+\[(\d+)]/;
                let match = decoded.match(failedToParse);
                if (match) {
                    let lineNumber = +match[1];
                    diagnostics.push(new vscode.Diagnostic(rangeForLineNumber(lineNumber - 1, textDocument), "Failed to parse", vscode.DiagnosticSeverity.Error));
                    parsed = false;
                }
            }
            if (parsed) {
                let re = /^line (\d+): (.*)/gm, match;
                while (match = re.exec(decoded)) {
                    let severity = vscode.DiagnosticSeverity.Warning;
                    let message = match[2];
                    let lineNumber = +match[1];
                    diagnostics.push(new vscode.Diagnostic(rangeForLineNumber(lineNumber - 1, textDocument), message, severity));
                }
            }
            diagnosticCollection.set(textDocument.uri, diagnostics);
        });
    }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "mooncode" is now active!');

/*
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('extension.sayHello', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World!');
    });


    context.subscriptions.push(disposable);
*/

    diagnosticCollection = vscode.languages.createDiagnosticCollection("moonscript");
    context.subscriptions.push(diagnosticCollection);

    vscode.workspace.onDidOpenTextDocument(doLint, this, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument((textDocument) => {
        diagnosticCollection.delete(textDocument.uri);
    }, null, context.subscriptions);
    vscode.workspace.onDidSaveTextDocument(doLint, this);
    vscode.workspace.textDocuments.forEach(doLint, this); // lint all open moonscript documents
}

// this method is called when your extension is deactivated
export function deactivate() {
}