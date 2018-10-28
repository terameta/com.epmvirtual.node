* npm i -g nodemon
* Copy settings.sample.json to settings.json and update
* Copy epmvirtualnode.service file to /lib/systemd/system/epmvirtualnode.service
* Update epmvirtualnode.service file according to your needs
* Run below commands
	* sudo systemctl daemon-reload
	* sudo systemctl enable epmvirtualnode.service
	* sudo systemctl start epmvirtualnode.service
