import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputFile = 'git_history_diff.md';
const projectRoot = process.cwd();
const numberOfCommitsToProcess = 5;


function runGitCommand(command) {
    try {
        const output = execSync(`git ${command}`, { encoding: 'utf8', cwd: projectRoot, maxBuffer: 1024 * 1024 * 50, shell: true });
        return output.trim();
    } catch (error) {
        const errorMessage = `Git command failed: git ${command}`;
        throw new Error(`${errorMessage}\n${error.stderr || error.message}`);
    }
}

function getCommitDetails(commitHash) {
    try {
        const author = runGitCommand(`show -s --format=%an ${commitHash}`);
        const timestamp = runGitCommand(`show -s --format=%ct ${commitHash}`);
        const subject = runGitCommand(`show -s --format=%s ${commitHash}`);

        const date = new Date(parseInt(timestamp, 10) * 1000);
        const formattedDate = date.getFullYear() + '-' +
                              ('0' + (date.getMonth() + 1)).slice(-2) + '-' +
                              ('0' + date.getDate()).slice(-2) + ' ' +
                              ('0' + date.getHours()).slice(-2) + ':' +
                              ('0' + date.getMinutes()).slice(-2) + ':' +
                              ('0' + date.getSeconds()).slice(-2);


        const shortHash = commitHash.substring(0, 7);
        return `${shortHash} - ${author}, ${formattedDate} : ${subject}`;
    } catch (detailsError) {
        return `Could not retrieve details for commit ${commitHash.substring(0, 7)}`;
    }
}

function getGitignoreContentAtCommit(commitHash) {
    try {
         const content = execSync(`git show ${commitHash}:./.gitignore`, { encoding: 'utf8', cwd: projectRoot, maxBuffer: 1024 * 1024 * 10, shell: true }).trim();
        return content;
    } catch (error) {
        if (error.stderr && error.stderr.includes('exists on disk, but not in')) {
            return '';
        }
        return '';
    }
}

function parseGitignoreContent(content) {
    return content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));
}

function isFileIgnored(filePath, ignorePatterns) {
    return ignorePatterns.some(pattern => filePath.includes(pattern));
}


try {
    const absoluteOutputFile = path.resolve(projectRoot, outputFile);
    const absoluteOutputDir = path.dirname(absoluteOutputFile);
    if (!fs.existsSync(absoluteOutputDir)) {
        fs.mkdirSync(absoluteOutputDir, { recursive: true });
    }
    fs.writeFileSync(absoluteOutputFile, `# Full Git History and Diffs for ${path.basename(projectRoot)}\n\n`, 'utf8');
    let allGitignorePatterns = new Set();

    let gitignoreHistoryCommits = [];
    try {
         const historyOutput = runGitCommand(`log --pretty=format:%H --follow -- .gitignore || true`);
         gitignoreHistoryCommits = historyOutput.split('\n').filter(hash => hash.length > 0);
    } catch (error) {
         gitignoreHistoryCommits = [];
    }


    for (const commitHash of gitignoreHistoryCommits) {
        const content = getGitignoreContentAtCommit(commitHash);
        const patterns = parseGitignoreContent(content);
        patterns.forEach(pattern => allGitignorePatterns.add(pattern));
    }

    const currentGitignorePath = path.resolve(projectRoot, '.gitignore');
    if (fs.existsSync(currentGitignorePath)) {
        try {
            const currentContent = fs.readFileSync(currentGitignorePath, 'utf8');
            const currentPatterns = parseGitignoreContent(currentContent);
            currentPatterns.forEach(pattern => allGitignorePatterns.add(pattern));
        } catch (error) {
            // Ignore error
        }
    }

    const comprehensiveIgnorePatterns = Array.from(allGitignorePatterns);


    const revListCommand = numberOfCommitsToProcess > 0
        ? `rev-list --reverse --no-merges --topo-order -n ${numberOfCommitsToProcess} HEAD`
        : 'rev-list --reverse --no-merges --topo-order HEAD';

    const commitHashes = runGitCommand(revListCommand).split('\n').filter(hash => hash.length > 0);

    if (commitHashes.length === 0) {
        fs.appendFileSync(absoluteOutputFile, "No commits found in this repository or within the specified range.\n", 'utf8');
        process.exit(0);
    }


    const initialCommitHashInRange = commitHashes[0];

    let initialCommitContent = `## Commit: ${initialCommitHashInRange} (Oldest in selected range)\n\n`;
    initialCommitContent += `### Details\n\n${getCommitDetails(initialCommitHashInRange)}\n\n`;

    initialCommitContent += `### Files at this commit snapshot (excluding historically/currently gitignored)\n\n`;


    try {
         const treeHash = runGitCommand(`show --pretty=format:"%T" --no-patch ${initialCommitHashInRange}`);
         const initialFilesOutput = runGitCommand(`ls-tree -r -z ${treeHash}`);
         const initialFiles = initialFilesOutput.split('\0').filter(line => line.length > 0);

         if (initialFiles.length === 0 || initialFiles.every(line => line.startsWith('d'))) {
              initialCommitContent += "No trackable files found at this commit.\n";
         } else {
              const nonIgnoredInitialFiles = initialFiles.map(fileLine => {
                  const parts = fileLine.split('\t');
                  return parts.length > 1 ? parts[1] : null; // Extract just the file path
              }).filter(filePath => {
                  if (filePath === null) return false;
                  return !isFileIgnored(filePath, comprehensiveIgnorePatterns);
              });


             if (nonIgnoredInitialFiles.length === 0) {
                 initialCommitContent += "No non-ignored trackable files found at this commit.\n";
             } else {
                for (const fileLine of initialFiles) {
                     const parts = fileLine.split('\t');
                     if (parts.length < 2) continue;
                     const fileInfo = parts[0].split(/\s+/);
                     const fileType = fileInfo[1];
                     const blobHash = fileInfo[2];
                     const filePath = parts[1];

                     // Only include if the file is in our manually filtered non-ignored list
                     if (fileType === 'blob' && nonIgnoredInitialFiles.includes(filePath)) {
                         initialCommitContent += `#### File: ${filePath}\n\n`;
                         initialCommitContent += "```\n";
                                                      try {
                                 const fileContent = runGitCommand(`cat-file blob ${blobHash}`);
                                 initialCommitContent += fileContent.trimEnd() + '\n';
                             } catch (contentError) {
                                  initialCommitContent += `Error reading file content.\n`;
                         }
                         initialCommitContent += "```\n\n";
                     }
                }
             }
         }
    } catch (lsTreeError) {
         initialCommitContent += `Error listing files for the oldest commit in range.\n`;
    }

    fs.appendFileSync(absoluteOutputFile, initialCommitContent, 'utf8');
    for (let i = 1; i < commitHashes.length; i++) {
        const previousCommitHash = commitHashes[i - 1];
        const currentCommitHash = commitHashes[i];

        let commitBlock = `## Commit: ${currentCommitHash}\n\n`;
        commitBlock += `### Details\n\n${getCommitDetails(currentCommitHash)}\n\n`;

        commitBlock += `### Changes from ${previousCommitHash.substring(0, 7)} to ${currentCommitHash.substring(0, 7)} (excluding historically/currently gitignored)\n\n`;


        try {
            const diffCommand = `diff --patch --binary -M -C ${previousCommitHash} ${currentCommitHash}`;

            const rawDiffOutput = runGitCommand(diffCommand);

            let filteredDiffOutput = '';
            let skipThisFileDiff = false;
            const diffLines = rawDiffOutput.split('\n');

            for (const line of diffLines) {
                if (line.startsWith('diff --git')) {
                    const filePathMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
                    if (filePathMatch && filePathMatch[1]) {
                        const filePath = filePathMatch[1];
                        if (isFileIgnored(filePath, comprehensiveIgnorePatterns)) {
                            skipThisFileDiff = true;
                        } else {
                            skipThisFileDiff = false;
                        }
                    } else {
                         skipThisFileDiff = false;
                    }
                }

                if (!skipThisFileDiff) {
                    filteredDiffOutput += line + '\n';
                }
            }

             if (filteredDiffOutput.length > 0) {
                  filteredDiffOutput = filteredDiffOutput.trimEnd() + '\n';
             }


            if (filteredDiffOutput.length === 0) {
                 commitBlock += "No visible changes in non-ignored files.\n";
            } else {
                 commitBlock += "```diff\n";
                 commitBlock += filteredDiffOutput;
                 commitBlock += "```\n";
            }
        } catch (diffError) {
            commitBlock += `Error generating or processing diff.\n`;
        }

        commitBlock += "\n";

        fs.appendFileSync(absoluteOutputFile, commitBlock, 'utf8');
    }


} catch (error) {
    process.exit(1);
}