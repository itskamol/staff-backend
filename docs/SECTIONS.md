# 1 Overview
## 1.1 Introduction
## 1.2 Product Scope
## 1.3 Terms And Definitions
### 1.3.1 Access Permission
### 1.3.2 Person Type
### 1.3.3 Credential Type
### 1.3.4 EZVIZ Cloud Storage
### 1.3.5 Event
### 1.3.6 Listen
### 1.3.7 Listening Host
### 1.3.8 Person-Based Access Control
## 1.4 Symbols And Acronyms
## 1.5 Update History
# 2 Application Scenario
# 3 Layers in the Network Model
# 4 ISAPI Framework
## 4.1 Overview
## 4.2 Activation
## 4.3 Security Mechanism
### 4.3.1 Authentication
#### 4.3.1.1 C/C++ (libcurl)
#### 4.3.1.2 C# (WebClient)
#### 4.3.1.3 Java (HttpClient)
#### 4.3.1.4 Python (requests)
### 4.3.2 User Permission
### 4.3.3 Stream Encryption
### 4.3.4 Information Encryption
## 4.4 Video Streaming
### 4.4.1 Audio and Video Stream
### 4.4.2 Metadata
## 4.5 Message Parsing
### 4.5.1 Message Format
#### 4.5.1.1 XML
#### 4.5.1.2 JSON
#### 4.5.1.3 Binary Data
#### 4.5.1.4 Form (multipart/form-data)
### 4.5.2 Annotation
### 4.5.3 Capability Set
### 4.5.4 Time Format
### 4.5.5 Character Set
### 4.5.6 Error Processing
## 4.6 Event Uploading
### 4.6.1 Arming
### 4.6.2 Subscription
### 4.6.3 Listening
# 5 User Management
## 5.1 Introduction to the Function
## 5.2 API Calling Flow
## 5.3 Exception Handling
# 6 EZVIZ Access Services
## 6.1 Introduction to the Function
## 6.2 API Calling Flow
# 7 EZVIZ Storage Configuration
## 7.1 Introduction to the Function
## 7.2 API Calling Flow
# 8 Subscribe to Videos Related to Events
## 8.1 Introduction to the Function
## 8.2 API Calling Flow
# 9 Check the Statistics of Videos Uploaded/to be Uploaded
## 9.1 Introduction to the Function
## 9.2 API Calling Flow
# 10 Listening Service
## 10.1 Introduction to the Function
## 10.2 API Calling Flow
### 10.2.1 Listening Service
### 10.2.2 Event Message Grammar
## 10.3 Exception Handling
### 10.3.1 Error Codes
# 11 Device Upgrade
## 11.1 Introduction to the Function
## 11.2 API Calling Flow
# 12 Device Peripherals Upgrade
## 12.1 Introduction to the Function
## 12.2 API Calling Flow
# 13 Person and Credential Management
## 13.1 Introduction to the Function
# 14 Person Management
## 14.1 Introduction to the Function
## 14.2 API Calling Flow
### 14.2.1 Check Whether the Device Supports Person Management
### 14.2.2 Person Search
### 14.2.3 Person Applying
### 14.2.4 Person Adding
### 14.2.5 Person Information Editing
### 14.2.6 Person Deleting
# 15 Card Management
## 15.1 Introduction to the Function
## 15.2 API Calling Flow
### 15.2.1 Check Whether the Device Supports Card Management
### 15.2.2 Card Search
### 15.2.3 Card Applying
### 15.2.4 Card Adding
### 15.2.5 Card Information Editing
### 15.2.6 Card Deleting
### 15.2.7 Card Collecting
# 16 Fingerprint Management
## 16.1 Introduction to the Function
## 16.2 API Calling Flow
### 16.2.1 Check Whether the Device Supports Fingerprint Management
### 16.2.2 Fingerprint Search
### 16.2.3 Fingerprint Applying
### 16.2.4 Fingerprint Adding
### 16.2.5 Fingerprint Information Editing
### 16.2.6 Fingerprint Deleting
### 16.2.7 Fingerprint Collecting
# 17 Face Picture Management
## 17.1 Introduction to the Function
## 17.2 API Calling Flow
### 17.2.1 Check Whether the Device Supports Face Picture Management
### 17.2.2 Face Picture Search
### 17.2.3 Face Picture Applying
### 17.2.4 Face Picture Adding
### 17.2.5 Face Picture Information Editing
### 17.2.6 Face Picture Deleting
### 17.2.7 Face Picture Collecting
# 18 Iris Data Management
## 18.1 Introduction to the Function
## 18.2 API Calling Flow
### 18.2.1 Check Whether the Device Supports Iris Data Management
### 18.2.2 Iris Data Search
### 18.2.3 Iris Data Applying
### 18.2.4 Iris Data Adding
### 18.2.5 Iris Data Editing
### 18.2.6 Iris Data Deleting
### 18.2.7 Iris Data Collecting
# 19 Holiday Schedule of Voice Prompt
## 19.1 Introduction to the Function
## 19.2 API Calling Flow
# 20 Daily Schedule of Voice Prompt
## 20.1 Introduction to the Function
## 20.2 API Calling Flow
# 21 API Reference
## 21.1 Device Basic Information Management
### 21.1.1 Set the device information parameters
### 21.1.2 Get device information parameters
### 21.1.3 Get configuration capability of the device information parameters
## 21.2 User Management
### 21.2.1 Log in to the device by digest
### 21.2.2 Set information for a single user
### 21.2.3 Get information about a single user
### 21.2.4 Get the configuration capability of a specific user
### 21.2.5 Get information about all users
### 21.2.6 Set information about all users
### 21.2.7 Set the user permission of the device
### 21.2.8 Get all users' permission
### 21.2.9 Set permissions for a single user
### 21.2.10 Get the permission of a single user
### 21.2.11 Get the configuration capability of all users' permission
## 21.3 Time Management
### 21.3.1 Get the parameters of a specific NTP (Network Time Protocol) server
### 21.3.2 Get the parameters of a NTP server
### 21.3.3 Set the parameters of a NTP server
### 21.3.4 Get device time synchronization management parameters
### 21.3.5 Set device time synchronization management parameters
### 21.3.6 Get the capability of device time synchronization management
### 21.3.7 Get the configuration capability of parameters of a specific NTP (Network Time Protocol) server
### 21.3.8 Set parameters of all NTP servers
## 21.4 Log Management
### 21.4.1 Search for log information
### 21.4.2 Set log server parameters
### 21.4.3 Get log server parameters
### 21.4.4 Get the configuration capability of log servers
## 21.5 System Maintenance
### 21.5.1 Get the system service capability (JSON format)
### 21.5.2 Import device configuration file
### 21.5.3 Export device configuration file
### 21.5.4 Get the system security capability
### 21.5.5 Set device language parameters
### 21.5.6 Get the languages supported by the device
### 21.5.7 Get the capability of configuring the device language
### 21.5.8 Set SSH parameters
### 21.5.9 Get the storage capability of the device
### 21.5.10 Get the system service capability (JSON format)
### 21.5.11 Import the configuration files securely
## 21.6 Accessing via Protocol
### 21.6.1 Get device protocol capability
### 21.6.2 Get the security parameters of a single access protocol
### 21.6.3 Set the parameters of a specific protocol that supported by device
## 21.7 EZVIZ Access Management
### 21.7.1 Get EZ parameters
### 21.7.2 Set Hik-Connect parameters
### 21.7.3 Get the capability of configuring EZ access service
## 21.8 ISUP Access Management
### 21.8.1 Set the EHome server access parameters
### 21.8.2 Get the configuration capability of accessing servers via ISUP (EHome)
### 21.8.3 Get the ISUP server access parameters
## 21.9 Picture Storage Protocol Access Management
### 21.9.1 Set the picture storage server parameters
### 21.9.2 Get the configuration capability of the picture storage server
### 21.9.3 Get the parameters of the picture storage server
## 21.10 HTTP Listening Management
### 21.10.1 Set the parameters of a listening host
### 21.10.2 Get parameters of all listening hosts
### 21.10.3 Set IP address of receiving server(s)
### 21.10.4 Get the parameters of a listening host
### 21.10.5 Set the parameters of a listening host
### 21.10.6 Get the parameters of a listening host
### 21.10.7 Set IP address of receiving server(s)
### 21.10.8 Get parameters of all listening hosts
### 21.10.9 Get the capabilities of listening hosts parameters
### 21.10.10 Delete receiving server(s)
### 21.10.11 Delete a HTTP listening server
## 21.11 Protocol Certificate
### 21.11.1 Generate the signature request information of device certificate
### 21.11.2 Delete signature request of device certificate
### 21.11.3 Get the signature request information of device certificate
## 21.12 Upgrade Management
### 21.12.1 Upgrade devices
### 21.12.2 Get the device upgrade progress
### 21.12.3 Get the capabilities of peripheral module upgrade
### 21.12.4 Get the device upgrading status and progress
## 21.13 Video Image Settings
### 21.13.1 Get image standard parameters of a specific channel
### 21.13.2 Set the video signal standard for a specified channel
## 21.14 Image Adjustment
### 21.14.1 Get the image adjustment parameters in auto mode of a specific channel
### 21.14.2 Set the image adjustment parameters in auto mode of a specific channel
### 21.14.3 Get the sharpness control parameters of a specific channel
### 21.14.4 Set the sharpness control parameters of a specific channel
### 21.14.5 Restore the image parameters of a specific channel to default settings
### 21.14.6 Get the image mode parameters of all channels
### 21.14.7 Get the configuration parameters of all image modes of a specific channel
## 21.15 Image Light Supplement
### 21.15.1 Set supplement light parameters of a specific channel
### 21.15.2 Get supplement light parameters of a specific channel
### 21.15.3 Get the configuration capability of the supplement light parameters of a specific channel
## 21.16 Face Picture Library Management
### 21.16.1 Get the information, including library ID, library type, name, and custom information, of all face picture libraries
### 21.16.2 Set the face picture library parameters
### 21.16.3 Edit a face record in a specific face picture library
### 21.16.4 Get face picture library capability
### 21.16.5 Set the face picture data in the face picture library
### 21.16.6 Add a face record to the face picture library
### 21.16.7 Edit face records in the face picture library in a batch
## 21.17 Face Picture Library Management (To be Optimized)
### 21.17.1 Create a face picture library
### 21.17.2 Get the total number of face records in all face picture libraries
### 21.17.3 Get face picture library capability
### 21.17.4 Get the information, including library ID, library type, name, and custom information, of all face picture libraries
### 21.17.5 Delete all face picture libraries
## 21.18 Audio Input
### 21.18.1 Get parameters of all audio channels of the device
### 21.18.2 Get the configuration of a specific audio channel of the device
### 21.18.3 Get the audio capabilities
### 21.18.4 Set audio input parameters of a specific channel
### 21.18.5 Get the audio input parameters of a specified channel
### 21.18.6 Get the audio input capability of a specified channel
## 21.19 ID Card Management
### 21.19.1 Apply ID card blocklist
### 21.19.2 Get capability of applying ID card blocklist
### 21.19.3 ID card information event
## 21.20 Access Control Module Management
### 21.20.1 Get the configuration of the door lock status when the device is powered off
### 21.20.2 Set door lock status when the device is powered off
### 21.20.3 Get the door configuration capability
### 21.20.4 Get the door (floor) configuration parameters
### 21.20.5 Set the door (floor) parameters
### 21.20.6 Get the capability of getting the status of the secure door control unit
### 21.20.7 Get the status of the secure door control unit
### 21.20.8 Get the capability of configuring the door lock status when the device is powered off
## 21.21 Capture Parameters Management
### 21.21.1 Get capture triggering parameters
### 21.21.2 Set the capture triggering parameters
### 21.21.3 Get capability of getting capture triggering parameters
## 21.22 Person and Credential Management
### 21.22.1 Get the configuration capability of fingerprint parameters
### 21.22.2 Set the fingerprint parameters
### 21.22.3 Get the capability of clearing all pictures in the device
### 21.22.4 Get the capability of deleting person information (including linked cards, fingerprints, and faces) and permissions
### 21.22.5 Add cards and link them with a person
### 21.22.6 Delete person information
### 21.22.7 Get the capabilities of applying person data asynchronously
### 21.22.8 Get the card management capability
### 21.22.9 whether to delete card information
### 21.22.10 Get the total number of the added persons
### 21.22.11 Edit person information
### 21.22.12 Get the status of a specified task of applying person pictures asynchronously
### 21.22.13 Start deleting all person information (including linked cards, fingerprints, and faces) and permissions by employee No.
### 21.22.14 Add a person
### 21.22.15 Set person information
### 21.22.16 Edit card information
### 21.22.17 Set card information
### 21.22.18 Search for person information
### 21.22.19 Get the person management capability
### 21.22.20 Get the capability of deleting fingerprint data
### 21.22.21 Get the progress of deleting fingerprint data
### 21.22.22 Get the total number of the added cards
### 21.22.23 Get the progress of applying fingerprint data
### 21.22.24 Get the capabilities of applying person pictures asynchronously
### 21.22.25 Delete a specified task of applying person pictures asynchronously
### 21.22.26 Get the status of all tasks of applying person pictures asynchronously
### 21.22.27 Delete a specified task of applying person data asynchronously
### 21.22.28 Get the status of a specified task of applying person data asynchronously
### 21.22.29 Search for cards
### 21.22.30 Edit fingerprint parameters
### 21.22.31 Search the fingerprint information
### 21.22.32 Start deleting the fingerprint data
### 21.22.33 Get the status of all tasks of applying person data asynchronously
## 21.23 Anti-Passback
### 21.23.1 Set anti-passing back parameters of a card reader
### 21.23.2 Get the configuration capability of anti-passing back parameters of card readers
### 21.23.3 Get the capability of clearing anti-passback parameters
### 21.23.4 Get the anti-passing back configuration capability
### 21.23.5 Clear anti-passing back parameters
### 21.23.6 Set the anti-passing back parameters
### 21.23.7 Get the anti-passing back configuration parameters of a specified card reader
### 21.23.8 Get the parameters of anti-passback configuration
## 21.24 Mask Detection
### 21.24.1 Set the mask detection parameters
### 21.24.2 Get the mask detection parameters
### 21.24.3 Get the configuration capability of mask detection
## 21.25 Access Control Device Management
### 21.25.1 Get the capability of getting the working status of the access controller
### 21.25.2 Get the working status of the access controller
### 21.25.3 Get the configuration capability of the access controller
### 21.25.4 Set the parameters of the access controller
### 21.25.5 Get the configuration parameters of the access controller
## 21.26 Access Point Attendance
### 21.26.1 Get the configuration capability of the attendance schedule template
### 21.26.2 Get the list of attendance schedule templates
### 21.26.3 Get the configuration capability of attendance check by pressing the key
### 21.26.4 Get the capability of attendance mode parameters
### 21.26.5 Set the attendance mode parameters
### 21.26.6 Get the attendance mode parameters
### 21.26.7 Get the capability of configuring weekly attendance schedules
### 21.26.8 Set the parameters of the week attendance schedule
### 21.26.9 Get the parameters of the week attendance schedule
### 21.26.10 Set the parameters of the attendance schedule template
### 21.26.11 Get the parameters of the attendance schedule template
### 21.26.12 Get the parameter configuration of attendance check by pressing the key
### 21.26.13 Set the parameters of attendance check by pressing the key
## 21.27 Multi-Factor Authentication
### 21.27.1 Clear group parameters
### 21.27.2 Get the capability of clearing group parameters
### 21.27.3 Get the group configuration parameters
### 21.27.4 Set the group parameters
### 21.27.5 Get the configuration capability of multi-factor authentication mode
### 21.27.6 Set parameters of multi-factor authentication mode
### 21.27.7 Get the configuration parameters of multi-factor authentication mode
### 21.27.8 Get the group configuration capability
## 21.28 Access Control Event Management
### 21.28.1 Clear event card linkage configurations
### 21.28.2 Get the configuration capability of storing access control events
### 21.28.3 Set the event card linkage parameters
### 21.28.4 Get the total number of access control events by specific conditions
### 21.28.5 Get the event and card linkage configuration parameters
### 21.28.6 Search for access control events
### 21.28.7 Get the capability of searching for access control events
### 21.28.8 Get the capability of clearing event and card linkage parameters
### 21.28.9 Set the event optimization parameters
### 21.28.10 Get the configuration capability of event optimization
### 21.28.11 Get the event optimization configuration parameters
### 21.28.12 Set storage parameters of access control events
### 21.28.13 Get the storage parameters of access control events
### 21.28.14 Getting arming information
### 21.28.15 Getting arming information capability
### 21.28.16 Access control event
## 21.29 Access Point Status Schedule
### 21.29.1 Set parameters of door control weekly schedule
### 21.29.2 Get the configuration parameters of the door control holiday schedule
### 21.29.3 Get the configuration capability of the door control week schedule
### 21.29.4 Get the configuration capability of the door control holiday schedule
### 21.29.5 Get the configuration capability of the door control schedule template
### 21.29.6 Get the configuration parameters of the door control week schedule
### 21.29.7 Set parameters of door control holiday schedule
### 21.29.8 Set parameters of door control schedule template
### 21.29.9 Get parameters of door control schedule template
### 21.29.10 Get the configuration capability of the door control schedule
### 21.29.11 Get the configuration capability of door status parameters of holiday group
### 21.29.12 Get the holiday group configuration parameters of the door control schedule
### 21.29.13 Set parameters of door control schedule
### 21.29.14 Get the configuration parameters of the door control schedule
### 21.29.15 Clear access control schedule configuration parameters
### 21.29.16 Get the capability of clearing access control schedule configuration.
### 21.29.17 Set holiday group parameters of door control schedule
## 21.30 Credential Recognition Module Management
### 21.30.1 Get the configuration capability of enabling NFC (Near-Field Communication) function
### 21.30.2 Get the capability of configuring card No. authentication rule
### 21.30.3 Set Wiegand parameters
### 21.30.4 Get Wiegand parameters
### 21.30.5 Get the card reader configuration parameters
### 21.30.6 Set the card reader parameters
### 21.30.7 Get the configuration capability of the card reader
### 21.30.8 Set the parameters of intelligent identity recognition terminal
### 21.30.9 Get the parameters of intelligent identity recognition terminal
### 21.30.10 Get configuration capability of intelligent identity recognition terminal
### 21.30.11 Set the condition parameters of face picture comparison
### 21.30.12 Get the facial recognition parameters.
### 21.30.13 Get the capability of configuring facial recognition parameters.
### 21.30.14 Get the capability of Wiegand parameters
### 21.30.15 Get the capability of configuring parameters of the facial recognition mode.
### 21.30.16 Set the parameters of enabling NFC (Near-Field Communication) function
### 21.30.17 Get the parameters of enabling NFC (Near-Field Communication) function
### 21.30.18 Set the facial recognition mode parameters
### 21.30.19 Get the parameters of the facial recognition mode.
### 21.30.20 Get the configuration capability of the M1 card encryption verification
### 21.30.21 Get the configuration parameters of M1 card encryption verification
### 21.30.22 Set the parameters of M1 card encryption verification
### 21.30.23 Get the parameters of enabling RF (Radio Frequency) card recognition
### 21.30.24 Set the parameters of enabling RF (Radio Frequency) card recognition
### 21.30.25 Get the configuration capability of enabling RF (Radio Frequency) card recognition
### 21.30.26 Set the parameters of card No. authentication mode
### 21.30.27 Get the parameters of card No. authentication mode
### 21.30.28 Get the switching progress and configuration result of card No. authentication mode
## 21.31 Voice Prompt of Access Authentication
### 21.31.1 audio prompt control parameters
### 21.31.2 Get text parameters of the audio prompt
### 21.31.3 Get the text configuration capability of the audio prompt for the authentication results
## 21.32 Temperature Measurement
### 21.32.1 Get the capability of actively searching for face temperature screening events
### 21.32.2 Search for skin-surface temperature screening event
### 21.32.3 Set the temperature measurement parameters
### 21.32.4 Get the temperature measurement parameters
### 21.32.5 Get the configuration capability of temperature measurement parameters
### 21.32.6 Get the configuration capability of the black body
### 21.32.7 Set the black body parameters
### 21.32.8 Get the black body parameters
### 21.32.9 Get the calibration capability of the temperature measurement area
### 21.32.10 Set the calibration parameters of the temperature measurement area
### 21.32.11 Get the calibration parameters of the temperature measurement area
### 21.32.12 Get the configuration capability of temperature measurement parameters
### 21.32.13 Set the parameters of the temperature measurement area
### 21.32.14 Get the parameters of the temperature measurement area
### 21.32.15 Skin-surface temperature screening event
## 21.33 Permission Schedules for Persons and Access Points
### 21.33.1 Get the holiday group configuration capability of the access permission control
### 21.33.2 Get the schedule template configuration capability of the access permission control
### 21.33.3 Get weekly schedule configuration parameters
### 21.33.4 Get the weekly schedule configuration capability of the access permission control
### 21.33.5 Get the holiday schedule configuration capability of the access permission control
### 21.33.6 Get holiday schedule configuration parameters
### 21.33.7 Set the week schedule parameters of the access permission control
### 21.33.8 Set the holiday schedule parameters of the access permission control
### 21.33.9 Get the schedule template configuration parameters of the access permission control
### 21.33.10 Get the holiday group configuration parameters of the access permission control schedule
### 21.33.11 Set the holiday group parameters of the access permission control schedule
### 21.33.12 Set the schedule template parameters of the access permission control
## 21.34 Authentication Schedule Management
### 21.34.1 Get the holiday group configuration capability of the control schedule of the card reader authentication mode
### 21.34.2 Get the schedule template configuration capability of the card reader authentication mode
### 21.34.3 Get the control schedule configuration parameters of the card reader authentication mode
### 21.34.4 Set control schedule parameters of card reader authentication mode
### 21.34.5 Get the control schedule configuration capability of the card reader authentication mode
### 21.34.6 Get holiday schedule parameters of the card reader authentication mode
### 21.34.7 Set holiday schedule parameters of card reader authentication mode
### 21.34.8 Get the week schedule configuration parameters of the card reader authentication mode
### 21.34.9 Set the week schedule parameters of the card reader authentication mode
### 21.34.10 Get the holiday schedule configuration capability of the card reader authentication mode
### 21.34.11 Get the week schedule configuration capability of the card reader authentication mode
### 21.34.12 Set holiday group parameters of control schedule of card reader authentication mode
### 21.34.13 Set the schedule template parameters of the card reader authentication mode
### 21.34.14 Get the schedule template parameters of card reader authentication mode
### 21.34.15 Get the holiday group configuration parameters of the control schedule of the card reader authentication mode
## 21.35 Real-Time Collection
### 21.35.1 Get the capability of collecting face picture information.
### 21.35.2 Get capability of getting face picture collection progress
### 21.35.3 Get the progress of collecting face picture information
### 21.35.4 Collect face picture information
## 21.36 Video Intercom Basic Configuration
### 21.36.1 Get the configuration capability of the video intercom device ID
### 21.36.2 Set the video intercom device ID
### 21.36.3 Get the video intercom device ID
## 21.37 Interface Management
### 21.37.1 Get a specific page of a specific program
### 21.37.2 Get the page configuration capability