#!/bin/bash
cd ~/com.epmvirtual.node
pwd
date
git fetch origin
reslog=$(git log HEAD..origin/master --oneline)
echo $reslog
if [ "$reslog" != "" ] ; then
	echo thereischange
	git reset --hard origin/master
	git merge origin/master
	npm install
	sudo systemctl restart epmvirtualnode.service
else
	echo nochange
fi
