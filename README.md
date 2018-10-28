* npm i -g nodemon
* npm i -g ts-node
* npm i -g typescript
* git pull
* npm install
* Copy settings.sample.json to settings.json and update
* Copy epmvirtualnode.service file to /lib/systemd/system/epmvirtualnode.service
* Update epmvirtualnode.service file according to your needs
* Run below commands
	* sudo systemctl daemon-reload
	* sudo systemctl enable epmvirtualnode.service
	* sudo systemctl start epmvirtualnode.service
* Create a crontab entry with the following line (after updating to the correct folder):
	* \* \* \* \* \* sudo sh -c "chmod +x ~/com.epmvirtual.node/croner.sh;  sh ~/com.epmvirtual.node/croner.sh  >> ~/croner.log"
