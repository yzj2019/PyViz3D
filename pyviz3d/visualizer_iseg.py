"""
The interactive segmentation visualizer class \\
is used to build server-client with three.js and flask \\
for showing 3d scene and interactively segment 3d scene.
"""

from .points import Points
from .mesh import Mesh
from .camera import Camera
from .scene import Scene

import os
import sys
import shutil
import json
import numpy as np
import open3d as o3d

def euler_to_quaternion(x: float, y: float, z: float):
    cr = np.cos(x * 0.5)
    sr = np.sin(x * 0.5)
    cp = np.cos(y * 0.5)
    sp = np.sin(y * 0.5)
    cy = np.cos(z * 0.5)
    sy = np.sin(z * 0.5)
    q = np.zeros([4])
    q[0] = sr * cp * cy - cr * sp * sy  # x
    q[1] = cr * sp * cy + sr * cp * sy  # y
    q[2] = cr * cp * sy - sr * sp * cy  # z
    q[3] = cr * cp * cy + sr * sp * sy  # w
    return q

class Visualizer:
    def __init__(self,
                 position: np.array = np.array([3.0, 3.0, 3.0]),
                 look_at: np.array = np.array([0.0, 0.0, 0.0]),
                 up: np.array = np.array([0.0, 0.0, 1.0]),
                 focal_length: float = 28.0, animation=False):

        self.camera = Camera(
            position=np.array(position),
            look_at=np.array(look_at),
            up=np.array(up),
            focal_length=focal_length,
            animation=animation
        )
        self.elements = {"Camera_0": self.camera}

    def __parse_name(self,
                     name: str) -> str:
        """Makes sure the name does not contain invalid character combinations.

        :param name:
        :return:
        """
        return name.replace(':', ';')

    def save(self,
            path: str,
            port: int=6008,
            verbose=True):
        """Creates the visualization and displays the link to it.

        :param path: The path to save the visualization files.
        :param port: The port to show the visualization.
        :param verbose: Whether to print the web-server message or not.
        """

        # Delete destination directory if it exists already
        directory_destination = os.path.abspath(path)
        if os.path.isdir(directory_destination):
            shutil.rmtree(directory_destination)

        # Copy website directory
        directory_source = os.path.realpath(os.path.join(os.path.dirname(__file__), "src"))
        shutil.copytree(directory_source, directory_destination)

        # use index-iseg.html as index.html
        html_src = os.path.join(directory_destination, "index-iseg.html")
        html_tgt = os.path.join(directory_destination, "index.html")
        os.remove(html_tgt)
        os.rename(html_src, html_tgt)

        # Assemble binary data files
        data_destination = os.path.join(directory_destination, "data")
        nodes_dict = {}
        for name, e in self.elements.items():
            binary_file_path = os.path.join(data_destination, name + ".bin")
            nodes_dict[name] = e.get_properties(name + ".bin")
            e.write_binary(binary_file_path)

        # Write json file containing all scene elements
        json_file = os.path.join(directory_destination, "nodes.json")
        with open(json_file, "w") as outfile:
            json.dump(nodes_dict, outfile)

        if not verbose:
            return

        # Display link
        http_server_string = "python -m SimpleHTTPServer " + str(port)
        if sys.version[0] == "3":
            http_server_string = "python -m http.server " + str(port)
        print("")
        print(
            "************************************************************************"
        )
        print("1) Start local server:")
        print("    cd " + directory_destination + "; " + http_server_string)
        print("2) Open in browser:")
        print("    http://localhost:" + str(port))
        print(
            "************************************************************************"
        )


    def add_points(
        self,
        name: str,
        positions: np.array,
        colors: np.array=None,
        normals: np.array=None,
        point_size: int=25,
        resolution: int=5,
        visible: bool=True,
        alpha: float=1.0,
    ):
        """Add points to the visualizer.

        :param name: The name of the points displayed in the visualizer. Use ';' in the name to create sub-layers.
        :param positions: The point positions.
        :param normals: The point normals.
        :param colors: The point colors.
        :param point_size: The point size.
        :param resolution: The resolution of the blender sphere.
        :param visible: Bool if points are visible.
        :param alpha: Alpha value of colors.
        """

        assert positions.shape[1] == 3
        assert colors is None or positions.shape == colors.shape
        assert normals is None or positions.shape == normals.shape

        shading_type = 1  # Phong shading
        if colors is None:
            colors = np.ones(positions.shape, dtype=np.uint8) * 50  # gray
        if normals is None:
            normals = np.ones(positions.shape, dtype=np.float32)
            shading_type = 0  # Uniform shading when no normals are available

        positions = positions.astype(np.float32)
        colors = colors.astype(np.uint8)
        normals = normals.astype(np.float32)

        alpha = min(max(alpha, 0.0), 1.0)  # cap alpha to [0..1]

        self.elements[self.__parse_name(name)] = Points(
            positions, colors, normals, point_size, resolution, visible, alpha, shading_type
        )


    def add_mesh(self,
                 name: str,
                 path: str,
                 translation: np.array=np.array([0.0, 0.0, 0.0]),
                 rotation: np.array=np.array([0.0, 0.0, 0.0, 1.0]),  # [x, y, z, w] - rotate w degrees rad around the axis xyz
                 scale: np.array=np.array([1, 1, 1]),
                 color: np.array=None,
                 visible: bool=True):
        """Adds a polygon mesh to the scene as specified in the path.
         
          The path is currently limited to .obj files and the color is the uniform color of the objetc.
        """
        rotation /= np.linalg.norm(rotation)  # normalize the orientation
        self.elements[self.__parse_name(name)] = Mesh(path, translation=translation, rotation=rotation, scale=scale, color=color, visible=visible)