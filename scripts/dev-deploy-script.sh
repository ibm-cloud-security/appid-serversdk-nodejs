#!/bin/bash
set -ev
echo TRAVIS_PULL_REQUEST $TRAVIS_PULL_REQUEST
echo TRAVIS_BRANCH $TRAVIS_BRANCH
echo TRAVIS_NODE_VERSION $TRAVIS_NODE_VERSION

if [ "${TRAVIS_PULL_REQUEST}" != "false" ]; then
	exit 0
fi
if [ "${TRAVIS_NODE_VERSION}" != "false" ]; then
	exit 0
fi

echo "hello!"
