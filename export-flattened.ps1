$targetDir = "lovelace-lcars-card/lovelace-lcars-card"
$sourceDir = "src"
$structureFilePath = "$targetDir/structure.md"

# Check if the target directory exists
if (Test-Path $targetDir) {
    # If it exists, remove its contents.
    # Get-ChildItem lists files and folders directly under $targetDir.
    # Remove-Item then deletes them.
    Get-ChildItem -Path $targetDir -Force | Remove-Item -Recurse -Force
} else {
    # If it doesn't exist, create it.
    New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
}

# Copy files from source to target, flattening the structure.
Get-ChildItem -Path $sourceDir -Recurse -File | Copy-Item -Destination $targetDir -Force

# Generate directory structure of src/ and save to structure.md
# Using cmd /c to call the tree command and Out-File to save its output.
cmd /c tree $sourceDir /F /A | Out-File -FilePath $structureFilePath -Encoding utf8 