# import required libraries
import logging
import sys

from app.core.config import settings 

def setup_logging() -> None:
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    logging.basicConfig(
        # set log level
        level=log_level,
        # set format
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        # print out to terminal
        handlers=[logging.StreamHandler(sys.stdout)],
        # overwrite any existing logggin setup
        force=True,
    )

    # get the logger named app and set the log level
    logging.getLogger("app").setLevel(log_level)