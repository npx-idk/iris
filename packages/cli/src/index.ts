#!/usr/bin/env node
import { Command } from 'commander'
import { runCommand } from './commands/run'

const program = new Command()

program
  .name('iris')
  .description('Iris — AI-powered browser test runner')
  .version('0.0.1')

program
  .command('run')
  .description('Trigger a project test suite or single test and wait for results')
  .option('--project <id>', 'Project ID — runs all enabled tests in the project')
  .option('--test <id>', 'Test ID — runs a single test')
  .option('--url <url>', 'Iris API base URL', process.env.IRIS_URL)
  .option('--key <key>', 'Iris API key (iris_...)', process.env.IRIS_KEY)
  .option('--poll <ms>', 'Poll interval in milliseconds', '3000')
  .option('--timeout <ms>', 'Maximum wait time in milliseconds', '600000')
  .action(runCommand)

program.parseAsync().catch((e) => {
  process.stderr.write(`\nUnexpected error: ${e.message}\n`)
  process.exit(1)
})
