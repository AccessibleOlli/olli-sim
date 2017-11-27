#!/bin/bash

bx target -o rrsingh@us.ibm.com -s olli
bx cf push -f manifest.yml

