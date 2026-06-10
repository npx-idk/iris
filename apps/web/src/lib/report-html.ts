import type { TestRun, TestWithSteps } from "./types"

/** Builds the HTML report for a finished run; parsed into BlockNote blocks by ReportSheet. */
export function generateHtmlReport(
  test: TestWithSteps | undefined,
  activeRun: TestRun | undefined,
  project: { baseUrl?: string } | undefined
): string {
  if (!test || !activeRun) return ""

  const duration =
    activeRun.finishedAt && activeRun.createdAt
      ? (
          (new Date(activeRun.finishedAt).getTime() -
            new Date(activeRun.createdAt).getTime()) /
          1000
        ).toFixed(1) + "s"
      : "N/A"

  const stepsList = activeRun.stepResults ?? []

  let html = `<h1>Test Execution Report: ${test.name}</h1>`
  if (test.description) {
    html += `<p><em>${test.description}</em></p>`
  }
  html += `<h2>Summary</h2>`
  html += `<ul>`
  html += `<li><strong>Status</strong>: ${activeRun.status}</li>`
  html += `<li><strong>Run ID</strong>: <code>${activeRun.id}</code></li>`
  html += `<li><strong>Date</strong>: ${new Date(activeRun.createdAt).toLocaleString()}</li>`
  html += `<li><strong>Browser Environment</strong>: ${activeRun.browserEnv ?? "N/A"}</li>`
  html += `<li><strong>Steps</strong>: ${activeRun.passedSteps} / ${activeRun.totalSteps} passed</li>`
  html += `<li><strong>Duration</strong>: ${duration}</li>`
  if (activeRun.totalTokens) {
    html += `<li><strong>Tokens Used</strong>: ${activeRun.totalTokens}</li>`
  }
  if (activeRun.inferenceTimeMs) {
    html += `<li><strong>Inference Time</strong>: ${(activeRun.inferenceTimeMs / 1000).toFixed(1)}s</li>`
  }
  html += `</ul>`

  if (activeRun.status === "FAILED") {
    html += `<h2>Execution Failure Context</h2>`
    if (activeRun.errorMessage) {
      html += `<p><strong>Error Message</strong>: <code>${activeRun.errorMessage}</code></p>`
    }

    html += `<h3>How to Reproduce</h3>`
    html += `<p>This error occurred under the <strong>${activeRun.browserEnv ?? "LOCAL"}</strong> browser environment. To reproduce this failure:</p>`
    html += `<ol>`
    if (test.startUrl) {
      html += `<li>Navigate to the start URL: <code>${test.startUrl}</code></li>`
    } else if (project?.baseUrl) {
      html += `<li>Navigate to the project base URL: <code>${project.baseUrl}</code></li>`
    }

    let foundFailure = false
    stepsList.forEach((step, idx) => {
      if (foundFailure) return
      if (step.result === "FAILED") {
        html += `<li><strong>Failed Step (Step ${idx + 1})</strong>: <code>${step.instruction}</code> (Error: <em>${step.errorMessage ?? "Unknown error"}</em>)</li>`
        foundFailure = true
      } else {
        html += `<li>Execute step ${idx + 1}: <code>${step.instruction}</code></li>`
      }
    })
    html += `</ol>`
  }

  html += `<h2>Steps Execution</h2>`

  if (stepsList.length === 0) {
    html += `<p><em>No steps recorded.</em></p>`
  } else {
    html += `<table>`
    html += `<thead>`
    html += `<tr><th>#</th><th>Instruction</th><th>Result</th><th>Duration</th><th>Error Message</th></tr>`
    html += `</thead>`
    html += `<tbody>`
    stepsList.forEach((step) => {
      const stepDuration = (step.durationMs / 1000).toFixed(1) + "s"
      const error = step.errorMessage ? step.errorMessage : ""
      html += `<tr>`
      html += `<td>${step.stepIndex + 1}</td>`
      html += `<td>${step.instruction}</td>`
      html += `<td><strong>${step.result}</strong></td>`
      html += `<td>${stepDuration}</td>`
      html += `<td>${error}</td>`
      html += `</tr>`
    })
    html += `</tbody>`
    html += `</table>`
  }

  return html
}
