# keyword-detection-onnx-js

This project is designed to identify a keyword on long video or audio files.
That is, the keyword detection problem is being solved. To do this a convolutional neural network trained on spectrograms of male Russian speech is used.
The keyword that the network responds to must contain the word "Donat".
To demonstrate the work, upload a file or record audio using a microphone by pressing a button.
All calculations are carried out on your device and this site easily performs its task without an Internet connection.

## How does it work?
The audio track obtained from the media file is divided into segments lasting a thousand seconds.
Each such segment is fed to the input of the model. The model also outputs a list with float numbers. The position of the number in the list corresponds to the timestamp.
If the number is greater than zero, then we assume that the spoken sound contains the word Donat.

Since recordings of one person's speech were used to train the model the quality of detecting the voices of others will be worse.
Therefore, instead of a threshold value of zero you can set your own value in the settings to increase the sensitivity of the algorithm.

Also, the model often confuses consonant phrases. For example, "zhenyat" or sentences with the pronoun "ona".
Therefore, for convenience, the identified timestamps can be rejected by clicking on the cross next to it.
If you accidentally deleted it, it's okay, the action can be canceled by clicking the undo button.

Finally, the list with timestamps can be saved to the clipboard by clicking the copy button.

## Model's architecture

It's a simple convolutional network with 8, 16, 32, 61 and 128 sequantial 3x3 filters, followed by global max pooling. Model can be applied on images with fixed height (192 pixels) and dynamic width. It was trained on fixed-sized samples of 1 seconds on dataset with approximately 60 hrs of speech. As for the loss function, the contrastive loss was utilized to distinguish keyword phrases from other ones.

After training the last fully-connected layer was deleted features which were extracted after global max pooling were used for training logistic regression with L1 penalty on top of it. Logistic regression was trained on test part. This trick helped to throw away unneccessary filters from last layers (128 -> 51). So the model becomes more lightweight.


Model's architecture acquired from [__Netron__](https://github.com/lutzroeder/netron):


