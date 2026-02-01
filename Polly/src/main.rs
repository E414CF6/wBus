//! Main Entry Point for Polly Application
//!
//! This module serves as the main entry point for the Polly application,
//! which provides functionalities for bus route information collection
//! and bus schedule crawling. It utilizes command-line arguments to
//! determine which operation to perform.

mod config;
mod route;
mod schedule;
mod utils;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};

use route::RouteArgs;
use schedule::ScheduleArgs;

#[derive(Parser)]
#[command(author, version, about)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Bus Route Information Collection and Snapping
    Route(RouteArgs),
    /// Bus Schedule Crawling
    Schedule(ScheduleArgs),
}

#[tokio::main]
async fn main() -> Result<()> {
    // Load environment variables from .env file, if present
    dotenvy::dotenv().ok();

    // Initialize tracing subscriber for logging
    tracing_subscriber::fmt::init();

    // Parse command-line arguments
    let cli = Cli::parse();
    match cli.command {
        Commands::Route(args) => {
            route::run(args).await.context("Route processing failed")?;
        }
        Commands::Schedule(args) => {
            schedule::run(args)
                .await
                .context("Schedule processing failed")?;
        }
    }

    Ok(())
}
